# Changelog

## 2026-09-11

### Desconexão em tempo real após bloqueio administrativo

- concluído o commit `01db8f7 feat(auth): desconecta sockets apos revogacao de sessoes`: o bloqueio administrativo continua revogando todas as sessões ativas na transação e, somente após seu commit, um notifier local informa o `ConversationsGateway` sobre o usuário bloqueado;
- o gateway desconecta os sockets locais desse usuário sem afetar conexões de outros usuários; o listener do notifier é removido no lifecycle do gateway;
- os testes passaram com `--detectOpenHandles`;
- limitação conhecida: a propagação é local à instância. Realtime multi-instância com Redis/Socket.IO adapter permanece trabalho futuro.

## 2026-09-10

### Rate limit distribuído com Redis

- concluído o commit `d3f2183 feat(api): centraliza rate limit com Redis`: a configuração do `ThrottlerModule` foi centralizada e o contador passou a usar storage Redis compartilhado com `@nest-lab/throttler-storage-redis` 1.2.0 e `ioredis` 5.11.1;
- `REDIS_URL` tornou-se obrigatória, aceita somente `redis://` e `rediss://` e não possui valor padrão no código. Falhas de Redis não usam fallback silencioso para storage em memória;
- o `ThrottlerGuard` permanece explícito somente nos endpoints protegidos. Os limites anteriores foram preservados e `POST /api/v1/auth/register` passou a aceitar 5 requisições por 15 minutos;
- um teste com duas aplicações Nest independentes e o mesmo Redis comprovou o contador compartilhado pela sequência HTTP `200, 200, 200, 200, 200, 429`. Outro cenário comprovou comportamento fail-closed com Redis indisponível, sem contador local;
- o lifecycle das conexões foi validado e `--detectOpenHandles` não encontrou handles Redis abertos. Build e testes passaram. Um warning de teardown do Jest ainda aparece em algumas execuções normais, sem evidência de vazamento Redis e sem uso de `--forceExit`; sua causa permanece como ponto técnico separado a investigar;
- este registro não afirma deploy ou uso em produção e não expõe URL ou credenciais Redis.

## 2026-09-09

### Testes reais de concorrência de autenticação

- concluído o commit `020fd3b test(auth): adiciona testes reais de concorrencia`: a API passou a ter uma configuração Jest exclusiva para integração em `apps/api/jest.integration.config.cjs` e o script `test:integration`, sem misturar essa suíte aos testes unitários;
- a suíte usa exclusivamente o PostgreSQL local `soravi_integration_test`, com três clientes Prisma independentes. A conexão aceita somente protocolo PostgreSQL, host `localhost` ou `127.0.0.1`, porta `5432` e database exatamente `soravi_integration_test`; antes das fixtures, `current_database()` confirma novamente o banco. Nenhuma URL ou credencial é registrada, migrations não são executadas automaticamente e o banco local normal `soravi` não recebe fixtures;
- no cenário em que o login adquire primeiro o lock real de `User`, o bloqueio administrativo espera no PostgreSQL; após o login criar a sessão, o bloqueio prossegue, grava `BLOCKED` e revoga a única sessão criada;
- no cenário em que o bloqueio administrativo adquire primeiro o lock, o login pré-lê `ACTIVE`, tenta o `user.update` real e espera no PostgreSQL; após o bloqueio gravar `BLOCKED`, o login adquire o lock, revalida o status e falha com `AccountUnavailableException`. Nenhuma `AuthSession` persiste e `lastLoginAt` permanece `null` pela reversão transacional;
- nos dois cenários, a contenção real é confirmada com `pg_backend_pid()` e `pg_blocking_pids()`. A coordenação usa Promises/barreiras e `setImmediate` apenas para ceder o event loop durante o polling, sem `sleep` ou `setTimeout`. `$transaction`, `user.update`, `$queryRaw` e os locks não são simulados;
- essa infraestrutura foi preparada para reutilização em outros testes concorrentes. Login versus password reset, limite máximo de sessões e login versus troca de senha autenticada foram cobertos posteriormente pelos commits registrados abaixo; outros fluxos críticos ainda não implementados continuam pendentes.

### Concorrência entre login e confirmação de password reset

- concluído o commit `9443580 test(auth): cobre concorrencia entre login e reset de senha`: a suíte PostgreSQL real passou a cobrir também as duas ordens de aquisição do lock entre login e confirmação de password reset, usando exclusivamente `soravi_integration_test` e sem usar ou alterar dados do banco local normal `soravi`;
- quando o login vence, o `user.update` real adquire o lock de `User`, a transação do reset fica realmente bloqueada no PostgreSQL e a contenção é confirmada por `pg_backend_pid()` e `pg_blocking_pids()`. O login cria uma `AuthSession`; depois, o reset altera o `passwordHash`, consome o `PasswordResetToken` e revoga essa sessão recém-criada;
- quando o reset vence, seu `SELECT ... FOR UPDATE` real adquire o lock de `User`; o login pré-lê `ACTIVE` e o hash antigo, tenta o `user.update` e fica realmente bloqueado. Após o reset trocar o hash e efetivar o commit, o login adquire o lock, detecta que o `passwordHash` difere do valor validado antes da transação e falha com `InvalidCredentialsException`; nenhuma nova `AuthSession` persiste e `lastLoginAt` permanece `null` pelo rollback;
- as operações Prisma permanecem reais: `$transaction`, `user.update`, `$queryRaw`, queries de `PasswordResetToken` e `AuthSession` não são simuladas. Promises/barreiras coordenam a ordem, e `setImmediate` é usado apenas para ceder o event loop durante o polling, sem `sleep` ou `setTimeout`;
- continuam pendentes os demais cenários concorrentes ainda não implementados. Este registro não afirma deploy nem altera o estado documentado de ASVS ou declara conformidade ASVS geral.

### Limite de sessões sob logins concorrentes

- concluído o commit `50b0277 test(auth): cobre limite de sessoes sob logins concorrentes`: a suíte PostgreSQL real passou a cobrir um usuário com cinco `AuthSession` ativas recebendo dois `loginWithSession` concorrentes;
- o login A adquire primeiro o lock real de `User`. O login B tenta o mesmo `user.update` e fica realmente bloqueado no PostgreSQL; seu `pg_backend_pid()` é capturado e `pg_blocking_pids()` confirma a contenção antes de A ser liberado. A aplica a regra de limite, revoga a sessão mais antiga, cria sua nova sessão e efetiva o commit; B então adquire o lock, consulta o estado atualizado, aplica novamente a regra e cria sua sessão. Ambos os logins terminam com sucesso e o `User` permanece `ACTIVE`;
- o estado final comprovado contém sete sessões no total, exatamente cinco ativas e duas revogadas. S1, S2 e S3 compartilham o mesmo `createdAt`; a ordenação `createdAt ASC` seguida de `id ASC` revoga S1 e S2, que têm os menores IDs, enquanto S3, S4, S5 e as duas novas sessões permanecem ativas;
- o teste considera ativa a sessão com `revokedAt === null`, `expiresAt` futuro e lifetime absoluto de 90 dias ainda válido. Ele usa exclusivamente `soravi_integration_test` e três clientes Prisma independentes (`controlPrisma`, `loginAPrisma` e `loginBPrisma`), sem usar ou alterar dados do banco local normal `soravi` e sem executar migrations;
- nenhuma operação Prisma relevante é simulada: `$transaction`, `user.update` e queries de `AuthSession` são reais. A coordenação usa Promises/barreiras e `setImmediate` apenas no polling, sem `sleep` ou `setTimeout`. Os demais cenários concorrentes ainda não implementados permanecem pendentes; não se afirma deploy, conformidade ASVS geral ou mudança no estado de V7.4.2.

### Concorrência entre login e troca autenticada de senha

- concluído o commit `a36a8a1 test(auth): cobre concorrencia entre login e troca de senha`: a bateria passou a totalizar sete testes de integração PostgreSQL real e a cobrir as duas ordens de aquisição do lock entre login e `UsersPasswordService`;
- quando o login vence, seu `user.update` adquire o lock real de `User`, e a troca de senha fica realmente bloqueada; `pg_backend_pid()` e `pg_blocking_pids()` confirmam a contenção antes da liberação. O login cria uma nova `AuthSession` e efetiva o commit; depois, a troca altera o `passwordHash`, preserva ativa a `currentSession` usada na operação e revoga a sessão recém-criada pelo login. `lastLoginAt` permanece atualizado;
- quando a troca vence, o `SELECT ... FOR UPDATE` real de `User` mantém o lock. O login pré-lê `ACTIVE` e o hash antigo, bloqueia no `user.update` e só prossegue após a troca atualizar o hash e efetivar o commit. Ao adquirir o lock, o login detecta que `lockedUser.passwordHash` difere do hash validado antes da transação e falha com `InvalidCredentialsException`; nenhuma nova sessão persiste, `lastLoginAt` permanece `null` pelo rollback e a `currentSession` existente continua ativa;
- operações Prisma e locks permanecem reais, sem mocks de `$transaction`, `$queryRaw`, `user.update` ou `AuthSession`. Promises/barreiras coordenam os testes; `setImmediate` apenas cede o event loop durante o polling, sem `sleep` ou `setTimeout`. A suíte usa exclusivamente `soravi_integration_test`, não altera o banco local normal `soravi` e não executa migrations;
- o estado consolidado cobre login versus bloqueio administrativo, login versus confirmação de password reset, limite de cinco sessões sob logins concorrentes e login versus troca autenticada de senha. Outros cenários não implementados permanecem pendentes. Não se afirma deploy, conformidade ASVS geral ou alteração do estado documentado de V7.4.2.

## 2026-09-08

### Moderação administrativa de status de contas

- concluído o commit `fce91dc feat(admin): adiciona bloqueio seguro de contas`: criado `PATCH /api/v1/users/admin/:userId/status`, com body estrito `{ "status": "ACTIVE" | "BLOCKED" }` e resposta `204 No Content`;
- o endpoint usa `AccessTokenGuard`, `RolesGuard` e `Role.ADMIN`, valida o `userId` alvo como UUID, obtém `actorUserId` do contexto autenticado e não exige telefone verificado. Atua somente sobre contas CUSTOMER e PROFESSIONAL: impede alteração da própria conta ADMIN e de qualquer outra conta ADMIN, rejeita contas soft-deleted e mantém `PENDING`, `SUSPENDED` e `DEACTIVATED` fora deste fluxo;
- `ACTIVE -> BLOCKED` atualiza o status e revoga todas as `AuthSession` ainda ativas na mesma transação Prisma, após `SELECT ... FOR UPDATE` da linha de `User`. `BLOCKED -> BLOCKED` é idempotente e ainda revoga sessões residuais; `BLOCKED -> ACTIVE` não restaura sessões; `ACTIVE -> ACTIVE` é no-op. O `AccessTokenAuthService` continua rejeitando contas `BLOCKED`, e `revokedAt` registra explicitamente a revogação causada pelo bloqueio;
- a proteção contra alvo ADMIN é verificada no mesmo fluxo transacional. O lock atual protege a linha de `User`, mas não `user_roles`; uma futura promoção ou rebaixamento concorrente de ADMIN exigirá revisão específica;
- concluído o commit `7f7b5dd feat(admin): adiciona moderacao de contas no painel`: clientes e profissionais passaram a exibir Bloquear/Reativar no mobile e desktop somente para `ACTIVE`/`BLOCKED`; os demais status exibem "Sem ação disponível". Há confirmação inline obrigatória, mensagens sobre encerramento/não restauração das sessões, atualização local apenas do item afetado sem reload ou novo fetch obrigatório e tratamento sanitizado de erros por código público;
- ASVS 5.0.0 V7.4.2 fica **parcialmente tratado**: o bloqueio `BLOCKED` revoga explicitamente todas as sessões, mas fluxos próprios de `SUSPENDED`, `DEACTIVATED` e exclusão/soft-delete ainda não existem e deverão revogar sessões explicitamente antes de se avaliar o requisito como integralmente tratado. Isso não afirma deploy nem conformidade ASVS geral.

## 2026-09-07

### Política segura de senha

- concluído o commit `5d204a0 fix(auth): centraliza politica segura de senha`: o backend passou a ser a autoridade única da política, aceitando senhas de 12 a 128 caracteres sem exigência obrigatória de letra, número, maiúscula, minúscula ou símbolo; qualquer composição nesse intervalo é permitida;
- a senha original nunca deve ser trimada, normalizada ou truncada antes de hashing ou verificação. O hashing permanece com Argon2id, e o login de contas existentes não aplica retroativamente a nova política;
- senhas comuns são bloqueadas somente no backend por uma blocklist versionada com exatamente 3000 entradas derivadas do SecLists. O lookup para detecção é case-insensitive e não modifica a senha original. A atribuição e o snapshot estão documentados em `apps/api/src/modules/auth/password-policy/ATTRIBUTION.md`; as 3000 entradas não são copiadas para a documentação;
- concluído o commit `ce06e44 fix(web): alinha formularios a politica de senha`: o frontend valida apenas a estrutura 12 a 128 caracteres, não contém a blocklist e trata o erro `PASSWORD_TOO_COMMON` retornado pelo backend;
- ASVS 5.0.0 V6.2.4 (rejeição de senhas comuns) e V6.2.5 (remoção das regras obrigatórias de composição) ficam registrados como tratados por esses commits, sem declarar conformidade ASVS geral. V6.2.2 e V6.2.3 foram tratados posteriormente pela troca de senha autenticada registrada abaixo.

### Troca de senha autenticada

- concluído o commit `f8ea104 feat(users): permite alterar a propria senha`: criado `PATCH /api/v1/users/me/password`, autenticado por Bearer access token e sessão válida, com body estrito `{ "currentPassword": string, "newPassword": string }` e resposta `204 No Content`;
- o backend obtém `userId` e `sessionId` somente do contexto autenticado, nunca do body, query ou params. A operação exige senha atual correta, exige que a nova senha seja diferente da atual, aplica a política central 12 a 128 com bloqueio de senhas comuns somente após validar a senha atual, nunca trima, normaliza ou trunca senhas, gera novo hash Argon2id e usa throttle de 3 tentativas por hora;
- a troca bloqueia o usuário com `SELECT ... FOR UPDATE` e executa na mesma transação: atualização do `passwordHash`, invalidação de `PasswordResetToken` pendentes e revogação de todas as outras `AuthSession` ativas. A sessão que realizou a alteração permanece ativa. Nenhuma migration ou alteração de schema foi necessária;
- concluído o commit `777732b feat(web): adiciona seguranca da conta`: criada a rota autenticada `/conta/seguranca`, com link `Conta` no header autenticado desktop/mobile, disponível para CUSTOMER, PROFESSIONAL e ADMIN sem restrição de papel;
- o formulário possui senha atual, nova senha e confirmação da nova senha. A confirmação existe somente no frontend e não é enviada à API; a validação estrutural reutiliza 12 a 128 sem composição obrigatória, a blocklist continua somente no backend, e os códigos `INVALID_CURRENT_PASSWORD`, `NEW_PASSWORD_MUST_DIFFER`, `PASSWORD_TOO_COMMON`, `401` e `429` são tratados com mensagens sanitizadas, sem exibir mensagens arbitrárias do backend;
- em `401`, os campos de senha são apagados antes do refresh da sessão, sem retry automático da alteração e sem redirecionamento automático. No sucesso, a sessão atual é preservada e a mensagem informa que as demais sessões foram encerradas;
- `/conta/seguranca` pode ser acessada por usuário autenticado com `phoneVerified=false`. O `PhoneVerificationGuard` não precisou ser modificado; foi adicionado teste para fixar esse comportamento;
- ASVS 5.0.0 V6.2.2 (usuário autenticado pode alterar a própria senha) e V6.2.3 (alteração exige senha atual + nova senha) ficam registrados como tratados por esses commits, preservando V6.2.4 e V6.2.5 como já tratados e sem declarar conformidade ASVS geral.

## 2026-09-06

### Rate limit em login e refresh

- concluído o commit `14734d3 fix(auth): adiciona rate limit em login e refresh`: `POST /auth/login` limitado a 10 requisições / 15 minutos e `POST /auth/refresh` a 60 requisições / 15 minutos, usando o `ThrottlerGuard` já existente no projeto (`@nestjs/throttler`);
- o armazenamento do contador de rate limit permanece em memória do processo; não há Redis nem storage compartilhado entre instâncias. Ao escalar horizontalmente, o limite não é coordenado entre processos — isso fica registrado como pendência de revisão, não como limitação resolvida.

### Limite de sessões simultâneas por conta

- concluído o commit `eecb5d6 fix(auth): limita sessoes simultaneas por conta`: no login, no máximo 5 `AuthSession` ativas por conta; a 6ª sessão válida é permitida e as sessões ativas mais antigas são revogadas para manter o total em 5;
- a regra vale igualmente para CUSTOMER, PROFESSIONAL e ADMIN. Sessões já revogadas, expiradas ou além do lifetime absoluto de 90 dias não entram na contagem; a ordenação usada para decidir quais revogar é determinística, por `createdAt` e depois `id`;
- o login usa transação interativa e a atualização real do `User` (`lastLoginAt`) como ponto de serialização antes de contar e revogar sessões. Os testes automatizados simulam a ordem de execução esperada; não comprovam concorrência real do PostgreSQL sob carga.

### Bloqueio de login com credencial desatualizada

- concluído o commit `e70392e fix(auth): bloqueia login com credencial desatualizada`: após obter o lock transacional do login, o `passwordHash`, o `status` e o `deletedAt` do usuário são revalidados; se o `passwordHash` mudou em relação à validação inicial (por exemplo, um reset de senha concorrente), o login é rejeitado;
- isso evita criar uma sessão nova baseada em uma senha anterior a um reset concluído entre a validação inicial e o lock. O Argon2 continua sendo executado fora da transação, como já ocorria;
- a recuperação de senha já usava `SELECT ... FOR UPDATE` e já revogava as sessões do usuário; este commit fecha a corrida do lado do login. Os testes simulam a ordem de eventos, não concorrência real do PostgreSQL.

### Serialização do refresh entre abas

- concluído o commit `96abdd6 fix(auth): serializa refresh entre abas`, no frontend: dentro da mesma aba, o refresh mantém single-flight por Promise; entre abas, quando o navegador expõe Web Locks, é usado o lock nomeado `soravi-auth-refresh`;
- nenhuma credencial ou token passou a ser armazenado em `localStorage`/`sessionStorage`, e nenhum token é transmitido por `BroadcastChannel`. Quando Web Locks não está disponível, o fallback preserva o comportamento anterior (executa o refresh diretamente), sem afirmar suporte universal da API de Web Locks em todos os navegadores.

### Histórico de refresh tokens

- concluído o commit `fa63449 feat(auth): cria historico de refresh tokens`: criada a tabela `auth_refresh_token_history`, vinculada a `AuthSession`, migration `20260906000100_create_auth_refresh_token_history`;
- somente o hash do token é persistido (nunca o token bruto); cada registro guarda `rotatedAt`, `expiresAt` (a expiração que o token antigo tinha antes de ser rotacionado) e `replayedAt` (preenchido apenas quando uma reutilização suspeita é detectada);
- a migration foi aplicada e validada somente no PostgreSQL local deste ambiente de desenvolvimento; produção não foi alterada.

### Detecção de replay de refresh token

- concluído o commit `0e2b376 fix(auth): detecta replay de refresh token`: o refresh continua rotacionando o token a cada uso; a proteção concorrente (CAS) da `AuthSession` e a criação do registro no histórico passaram a ocorrer na mesma transação interativa, de forma atômica. Um token já rotacionado nunca volta a ser válido, e sua reutilização sempre responde `401` via `InvalidRefreshTokenException`;
- grace period de até exatamente 60 segundos desde `rotatedAt`: reutilização nesse intervalo responde `401` sem revogar a sessão e sem marcar `replayedAt`, cobrindo o caso de duas requisições concorrentes terem lido o mesmo token antes da primeira rotação vencer o CAS;
- após 60 segundos, se o token ainda estaria dentro de sua validade original e a sessão correspondente segue ativa, a reutilização é classificada como replay suspeito: o histórico é marcado com `replayedAt` e **somente aquela `AuthSession`** é revogada — o mecanismo nunca revoga todas as sessões da conta;
- token aleatório ou não encontrado (nem como atual, nem no histórico), histórico já expirado, ou sessão associada já revogada/expirada/além do lifetime absoluto de 90 dias: todos esses casos respondem `401` sem qualquer revogação adicional. A resposta pública não diferencia replay de token simplesmente inválido;
- validações registradas na conclusão: suítes de `auth-refresh-replay.spec.ts` e `auth.service.spec.ts` (61 testes) e suítes adjacentes de auth passaram, TypeScript da aplicação e dos testes passou, build passou e `git diff --check` passou. Este registro não afirma deploy em produção nem execução de migration fora do ambiente local.

## 2026-09-05


### Lifetime absoluto da sessão

- concluído o commit `e3000fd fix(auth): limita lifetime absoluto da sessao`: lifetime absoluto da `AuthSession` de 90 × 24 horas desde `createdAt`, calculado por timestamp/milissegundos, sem cálculo por calendário;
- mantidos os padrões já existentes: access token de 15 minutos e refresh idle/sliding timeout de 30 dias. O `expiresAt` efetivo é o menor entre a expiração deslizante do refresh e `createdAt + 90 dias`; nenhuma renovação ultrapassa esse limite;
- refresh e autenticação por access token rejeitam sessões cujo lifetime absoluto terminou, inclusive sessões já existentes; após 90 dias desde `createdAt`, novo login é obrigatório;
- `AuthSession.createdAt` já existia: não houve alteração de schema nem migration. Login e refresh devolvem ao cookie exatamente o `expiresAt` efetivamente persistido. A proteção concorrente de rotação por `id` + `refreshTokenHash` + `revokedAt` + `expiresAt` foi preservada;
- validações registradas na conclusão: 43 testes passaram em 2 suítes, TypeScript da aplicação e dos testes passou e `git diff --check` passou. Este registro não afirma deploy em produção.

## 2026-09-04

### Hardening do cookie de refresh

- concluído o commit `e4210b9 fix(auth): endurece cookie de refresh`: `soravi_refresh_token` mantém `HttpOnly: true`, `SameSite: lax` e `Secure` somente quando `NODE_ENV === "production"`; o `Path` mudou de `/` para `/api/v1/auth`, reduzindo o envio do refresh cookie para outras rotas da API;
- opções comuns de set e clear centralizadas para evitar divergência; `expires` permanece somente na criação do cookie;
- percent-encoding inválido no cookie não gera `URIError`/500. Refresh com cookie malformado continua resultando em `UnauthorizedException`; logout com cookie ausente ou malformado não tenta revogar sessão, mas ainda limpa o cookie;
- criado teste específico do `AuthController`: os 7 testes novos do controller passaram, assim como regressões de autenticação, TypeScript e `git diff --check`. Este registro não afirma deploy em produção.

### CSP com nonce dinâmico no frontend

- concluído o commit técnico `40f766f feat(web): adiciona nonce dinamico ao CSP`;
- a CSP continua exclusivamente em `Content-Security-Policy-Report-Only`: o navegador não recebe nem aplica uma CSP bloqueante;
- o middleware gera, a cada requisição, um nonce criptograficamente imprevisível, encaminha-o nos request headers internos para o Next.js e o Next.js o aplica aos scripts renderizados; os dois componentes `next/script` do Google Analytics recebem o mesmo nonce;
- `script-src` deixou de usar `'unsafe-inline'` e passou a usar nonce e `'strict-dynamic'`; a CSP de production não permite `'unsafe-eval'`;
- API, WebSocket, ViaCEP, Google Analytics e a origin específica do R2 continuam explicitamente permitidos, sem wildcard nem `https:` genérico; HSTS continua condicionado ao ambiente production;
- o nonce no header CSP, sua variação entre requisições e sua presença no HTML foram validados localmente. Também passaram TypeScript, ESLint dos arquivos alterados, build do frontend e `git diff --check`; o navegador recebeu somente Report-Only e HSTS apareceu no teste local em modo production;
- como trade-off conhecido, o nonce por requisição tornou as páginas server-rendered dinamicamente, com impacto potencial de cache/performance a ser monitorado. Esta conclusão não representa deploy em produção nem ativação de CSP enforcement.

### Restrição de estilos inline no CSP

- concluído o commit técnico `83b25bf feat(web): restringe estilos inline no CSP`, sem alterar `script-src` ou o nonce;
- `style-src 'self' 'unsafe-inline'` foi substituído por `style-src 'self'`, `style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`. Assim, `'unsafe-inline'` de estilos permanece temporariamente apenas para atributos `style=""`;
- o diagnóstico local encontrou zero tags `<style>` no HTML inicial e no DOM observado, mas encontrou atributos `style=""` gerados em runtime, inclusive por elementos internos do Next.js/Next Image;
- a CSP segue exclusivamente em `Content-Security-Policy-Report-Only`, sem CSP bloqueante ativa no navegador e sem wildcard ou `https:` genérico.

### Zod sem JIT para compatibilidade com CSP

- concluído o commit técnico `c755262 feat(web): configura Zod sem JIT para CSP`;
- embora a CSP de production já não permitisse `'unsafe-eval'`, um teste local em modo production detectou, via Report-Only, uma tentativa de uso causada pela geração dinâmica de código/JIT do Zod 4.4.3;
- não foi adicionado `'unsafe-eval'` à CSP de production. Foi criado `apps/web/lib/zod.ts`, que executa `z.config({ jitless: true })`, e todos os imports diretos de Zod no código-fonte do frontend foram centralizados nesse módulo;
- schemas, mensagens de validação e regras de negócio não foram alterados. TypeScript, ESLint direcionado, build do frontend e `git diff --check` passaram, e a tela `/solicitacoes/nova` deixou de apresentar a violação de `'unsafe-eval'` anteriormente observada no teste local em production;
- os resultados são locais: não representam deploy em produção nem ativação de CSP enforcement.

## 2026-09-03

### Hardening HTTP e CSP do frontend

- removido o header `X-Powered-By` do Next.js e adicionados `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` restritiva; `Strict-Transport-Security` é aplicado somente em produção;
- adicionada `Content-Security-Policy-Report-Only` para observar violações sem enforcement e sem bloquear funcionalidades;
- a política permite explicitamente a API configurada, sua origem WebSocket equivalente, ViaCEP, Google Analytics e a origem privada R2 `https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com` usada pelas fotos;
- `img-src` ficou restrito a `'self'`, `data:`, `blob:` e à origin específica do R2, sem wildcard ou `https:` genérico;
- `script-src` e `style-src` ainda usam `'unsafe-inline'` temporariamente durante a fase report-only; naquela etapa, o `'unsafe-eval'` observado localmente estava associado ao Next.js/Fast Refresh em desenvolvimento e não seria liberado em produção — a tentativa posteriormente detectada no JIT do Zod está registrada na seção de 2026-09-04;
- testes locais confirmaram carregamento de fotos, navegação e chat sem novas violações funcionais de CSP;
- a próxima etapa será remover gradualmente `'unsafe-inline'` com nonce/hash e somente depois avaliar a ativação de uma CSP bloqueante.

## 2026-09-02

### Hardening de dependências

- reduzido o baseline de produção de `npm audit --omit=dev` de 14 para 6 vulnerabilidades por meio de atualizações compatíveis de Next.js para 15.5.25, `qs` para 6.16.0, `sharp` para 0.35.4, `fast-uri` para 3.1.7, `nanoid` para 3.3.18 e Prisma/`@prisma/client` para 7.10.0;
- o Prisma 7.10.0 removeu Hono e `@hono/node-server` da árvore vulnerável e atualizou `valibot` para 1.4.2;
- o baseline residual de 6 vulnerabilidades foi registrado como risco conhecido e monitorado, concentrado em `deepmerge-ts` 7.1.5, interno de `@prisma/config`; `mysql2` 3.15.3, interno do Prisma/tooling embora a Soravi use PostgreSQL; e `postcss` 8.4.31, fixado internamente pelo Next.js 15.5.25;
- não foi utilizado `npm audit fix --force` nem foram aplicados overrides em dependências internas do Prisma ou Next.js apenas para zerar a auditoria sem validação de compatibilidade;
- durante o primeiro patch de dependências, a API passou em TypeScript, 62 suítes com 678 testes e build; após as atualizações compatíveis do frontend, passaram TypeScript, ESLint e build; após a atualização do Prisma para 7.10.0, foram validados Prisma Client generation e build da API.

### Infraestrutura WhatsApp/Meta

- disponibilizado número oficial dedicado à Soravi, retirado do uso normal no WhatsApp Business App para registro na infraestrutura da Meta;
- confirmadas a WABA da Soravi e a inscrição do número na WhatsApp Cloud API;
- definido como pretendido o template `codigo_verificacao_soravi`, da categoria `AUTHENTICATION`, em `pt_BR`, com ação `COPY_CODE` e expiração de 10 minutos;
- a criação do template foi recusada pela Meta por falta de permissão da WABA; por isso, a entrega real de OTP, o webhook e a ativação do provider Meta em produção permanecem pendentes;
- Business Verification será retomada na preparação pré-beta, quando houver estrutura jurídica adequada, sem antecipar a formalização empresarial nem usar documentos de terceiros ou dados artificiais.

## 2026-09-01

### Recuperação de senha ponta a ponta

- conectado `/recuperar-senha` ao endpoint real, enviando somente o e-mail e mantendo respostas neutras, sanitizadas e sem persistência local;
- validado manualmente o fluxo completo `/recuperar-senha` → API → Resend → `/redefinir-senha`, incluindo recebimento do e-mail, rejeição de token expirado, troca da senha e login apenas com a nova credencial.

## 2026-08-31

### Segurança administrativa

- o script administrativo de troca de senha passou a invalidar todos os `PasswordResetToken` pendentes do ADMIN na mesma transação que atualiza o hash Argon2id e revoga as sessões;
- tokens já utilizados permanecem inalterados e a operação inteira sofre rollback se a invalidação falhar.

### Recuperação de senha

- implementado adapter Resend por `PasswordResetDeliveryPort`, preservando o desacoplamento do provider de e-mail;
- concluído o frontend seguro de `/redefinir-senha`, com token recebido em `#token`, remoção imediata do fragmento da URL, manutenção do token somente em memória e confirmação sem auto-login.

## 2026-08-30

### Alteração segura de telefone

- implementado `PATCH /api/v1/users/me/phone`, autenticado e limitado a três alterações por hora;
- a troca exige a senha atual e normaliza telefones brasileiros para E.164, rejeitando números inválidos ou já utilizados;
- informar o mesmo número normalizado funciona como no-op seguro, preservando verificação, challenges e sessões;
- uma mudança real zera `phoneVerifiedAt`, invalida challenges pendentes e revoga as demais sessões, preservando a sessão atual, tudo de forma transacional;
- a tela `/verificar-telefone` passou a permitir correção do número sem disparar OTP automaticamente, com máscara brasileira e limite de 11 dígitos nacionais.

### Recuperação de senha

- implementados `POST /api/v1/auth/password-reset/request` e `POST /api/v1/auth/password-reset/confirm`, com resposta antienumeração e rate limits próprios;
- criados tokens opacos de 256 bits em base64url, persistidos somente como SHA-256, com validade de 30 minutos e elegibilidade restrita a contas `PENDING` e `ACTIVE`;
- criada `PasswordResetDeliveryPort` fail-closed; nenhum provider real de e-mail foi escolhido;
- a confirmação bloqueia `User` antes de `PasswordResetToken` e, na mesma transação, atualiza a senha com Argon2id, consome todos os tokens pendentes e revoga todas as sessões;
- definido o link futuro `/redefinir-senha#token=<token>`.

## 2026-08-29

### Navegação e verificação de telefone

- o login passou a direcionar usuários conforme papéis e estado de verificação, enquanto cadastros concluídos retornam ao login;
- criado guard frontend centralizado para exigir `/verificar-telefone` nas rotas autenticadas aplicáveis;
- contas `ADMIN` ficaram temporariamente fora da exigência, evitando lockout enquanto o canal de entrega não está operacional em produção;
- criado `PhoneVerifiedGuard`; `phoneVerifiedAt` é carregado do banco em cada request autenticado e não foi adicionado ao JWT;
- o backend passou a declarar o guard explicitamente em ações sensíveis de solicitações, propostas, aceite, conversas e solicitações de categoria, mantendo leituras privadas sem essa exigência.

## 2026-08-28

### Verificação de telefone

- implementado adapter da Meta WhatsApp Cloud API atrás de `PhoneVerificationDeliveryPort`, selecionável por configuração e sem acoplar a validação do OTP ao provider;
- criada a página `/verificar-telefone`, com solicitação e confirmação autenticadas do código e tratamento dos estados públicos do fluxo;
- a integração Meta permaneceu não operacional em produção até configuração válida do provider e das credenciais.

### Operação administrativa

- criado script interativo para troca segura da senha ADMIN, com entrada oculta, validação de papel, política de senha, hash Argon2id e revogação transacional de sessões;
- a validação de `ADMIN_EMAIL` e `DATABASE_URL` passou a ocorrer antes da solicitação da senha, mantendo a saída sanitizada.

## 2026-08-27

### Fundação de verificação de telefone

- telefones brasileiros passaram a ser validados e normalizados para E.164 no cadastro, com unicidade sobre a representação canônica;
- criado `PhoneVerificationChallenge`, com OTP de seis dígitos protegido por HMAC, expiração, cooldown, limite de tentativas, consumo e invalidação;
- implementados os endpoints autenticados `POST /api/v1/phone-verification/request` e `POST /api/v1/phone-verification/confirm`;
- criada abstração `PhoneVerificationDeliveryPort` com implementação padrão indisponível e comportamento fail-closed;
- a seleção do provider foi desacoplada das credenciais Meta: o modo local permanece `unavailable`, e configuração Meta incompleta impede o bootstrap apenas quando esse provider é escolhido.

## 2026-08-26

### Jornadas de serviço e notificações

- nomes públicos passaram a ser exibidos nas telas de solicitações, oportunidades e conversas sem expor dados privados;
- criado endpoint de contagem de notificações não lidas e integrado o contador real ao sino do frontend;
- criados modelos e serviços de preferências de comunicação e `OutboundNotification`, preservando consentimento por canal e tipo de evento;
- oportunidades e propostas passaram a gravar eventos no outbox dentro de suas transações de domínio;
- adicionado processador periódico de elegibilidade do outbox, com políticas de conta, telefone verificado e preferências antes de liberar a entrega;
- preferências antigas sem evento associado não são tratadas como consentimento para novos eventos.

## 2026-08-25

### Notificações internas

- clientes passaram a receber notificação quando uma proposta é criada e profissionais quando uma nova oportunidade é distribuída;
- criada a página `/notificacoes`, o sino no cabeçalho e a navegação segura apenas para recursos autorizados;
- o envio de mensagem passou a notificar o outro participante da conversa;
- notificações de mensagens não lidas passaram a ser consolidadas por conversa, evitando acúmulo redundante;
- APIs de solicitações, oportunidades, propostas e conversas passaram a retornar nomes públicos adequados a cada jornada.

## 2026-08-24

### Conversas

- o detalhe da solicitação passou a expor `conversationId` ao participante autorizado após a contratação;
- criada listagem paginada de conversas para clientes e profissionais;
- adicionada a página compartilhada `/conversas` e seu acesso na navegação autenticada.

### Notificações

- criada a fundação persistente de notificações internas, com listagem autenticada, paginação, marcação de leitura e proteção por proprietário.

## 2026-08-23

### Chat em tempo real

- criada gateway autenticada para eventos de conversa, com validação da sessão no banco e autorização por participação;
- mensagens passaram a chegar em tempo real na tela da conversa, preservando o PostgreSQL como fonte oficial;
- corrigida a restauração do acesso do cliente à conversa após reload da página.

## 2026-08-21

### Conversas pós-contratação

- implementados detalhe de conversa, listagem paginada de mensagens, envio de mensagens e estado de leitura;
- criada a tela `/conversas/[conversationId]` para cliente e profissional;
- adicionados atalhos seguros para a conversa nos detalhes da solicitação contratada e da oportunidade profissional;
- o detalhe da oportunidade passou a expor `conversationId` somente ao participante autorizado.

## 2026-08-20

### Propostas e contratação

- propostas recebidas passaram a ser exibidas no detalhe da solicitação do cliente;
- criados os modelos persistentes `Contract` e `Conversation`;
- implementado aceite transacional de proposta, restrito ao cliente proprietário, criando contrato e conversa, aceitando a proposta escolhida e rejeitando as concorrentes;
- adicionada interface de aceite no frontend e ocultado o envio de proposta quando a solicitação já está contratada.

### Mensagens e experiência visual

- criados os modelos `Message` e `ConversationReadState` como fundação persistente do chat;
- fotos das solicitações passaram a poder ser ampliadas por clientes e profissionais em um lightbox compartilhado.

## 2026-08-19

### Solicitações e oportunidades

- implementada a criação de `ServiceRequest` diretamente em `OPEN`, com `editableUntil` de 10 minutos e `opportunitiesDispatchedAt` para controlar distribuição única;
- implementada edição direta durante a janela inicial para os campos autorizados e bloqueio posterior pelo backend;
- implementado cancelamento direto da solicitação própria enquanto estiver em `OPEN` e ainda não distribuída, preservando histórico e fotos;
- adaptado o upload de fotos para solicitações em `OPEN` durante a janela inicial, com persistência em `ServiceRequestFile` e storage privado Cloudflare R2;
- criado o modelo persistente `ServiceOpportunity`, único por `ServiceRequest` e `ProfessionalProfile`;
- implementada distribuição transacional e idempotente por categoria para profissionais `APPROVED`, disponíveis, não excluídos e vinculados à categoria;
- implementado processor periódico interno com `@nestjs/schedule`, intervalo padrão de 60 segundos e lote padrão de 50, sem Redis ou fila;
- registrado que matching geográfico, área de atendimento estruturada, notificações, fluxos de proposta e frontend profissional de oportunidades permanecem pendentes.

### Propostas

- criado o modelo `Proposal`, com vínculo direto a `ServiceRequest` e `ProfessionalProfile`, sem `serviceOpportunityId`;
- definidos os enums `ProposalStatus` e `EstimatedDurationUnit`;
- registrada a unicidade de uma proposta por profissional e solicitação;
- implementada a criação transacional de proposta pelo profissional, exigindo oportunidade correspondente e solicitação em `OPEN` ou `RECEIVING_PROPOSALS`;
- a primeira proposta transiciona a solicitação de `OPEN` para `RECEIVING_PROPOSALS` na mesma transação;
- criado formulário de envio de proposta no detalhe da oportunidade;
- implementada listagem paginada de propostas recebidas para o cliente proprietário da solicitação;
- matching geográfico não é exigido enquanto não existir área de atendimento estruturada.

## 2026-08-18

### Solicitações de serviço

- aprovada a nova regra de ciclo inicial: solicitações válidas deverão nascer em `OPEN`, com janela de 10 minutos para edição e cancelamento antes da distribuição aos profissionais;
- definidos conceitualmente `editableUntil` e `opportunitiesDispatchedAt`, além de futura moderação de alterações pós-distribuição, sem implementação de código, schema ou migration nesta etapa;
- marcado como superado o fluxo de produto baseado em criação `DRAFT` seguida de publicação manual, preservando o estado atual implementado até o próximo incremento;
- validado ponta a ponta o upload opcional de fotos em `/solicitacoes/nova`, com criação inicial da `ServiceRequest` em `DRAFT`, envio de uma foto por chamada, armazenamento em bucket privado no Cloudflare R2 e persistência dos metadados de `ServiceRequestFile` no PostgreSQL;
- confirmado upload real de JPEG com aproximadamente 3,68 MB no bucket `soravi-service-requests`, sem exposição pública do bucket.

## 2026-08-17

### Solicitações de serviço

- criada a persistência de `ServiceRequest`, com vínculo obrigatório a `CustomerProfile` e `Category`, localização estruturada e estado inicial `DRAFT`;
- implementados os endpoints autenticados para criar solicitação, listar solicitações próprias e consultar detalhes da solicitação própria;
- criadas as páginas `/solicitacoes/nova`, `/solicitacoes` e `/solicitacoes/[serviceRequestId]`;
- categorias da nova solicitação carregadas pela API e endereço preenchido automaticamente por CEP, com possibilidade de preenchimento manual;
- criada a persistência de `ServiceRequestFile`, com metadados da foto, `objectKey` e posição dentro da solicitação;
- criada a abstração `StorageService` com implementação compatível com S3 para bucket privado;
- Cloudflare R2 definido como armazenamento de objetos em produção, com credenciais fornecidas somente por variáveis de ambiente;
- implementado `POST /api/v1/service-requests/:serviceRequestId/photos` para upload de uma foto por chamada, restrito à solicitação própria em `DRAFT`;
- upload limitado a 5 fotos por solicitação e 5 MB por foto, aceitando JPEG, PNG e WebP com validação de MIME e magic bytes;
- persistência dos metadados ocorre após o upload, com remoção compensatória do objeto quando a gravação no banco falha;
- implementada a interface de seleção e upload opcional de fotos no frontend.

## 2026-08-14

### Sugestões públicas de categoria

- criado o fluxo público de sugestão de categoria pré-cadastro por meio de `PublicCategorySuggestion`;
- objetivo do fluxo: captar profissionais ainda não autenticados que não encontraram sua categoria durante o cadastro;
- separação explícita de domínio: fluxo público distinto de `LaunchInterest` e de `CategoryRequest`;
- envio da sugestão pública não cria conta profissional;
- envio da sugestão pública não cria `Category` automaticamente.

### API e segurança

- criado endpoint público `POST /api/v1/category-suggestions`;
- proteção básica contra abuso com throttling/rate limit na rota pública;
- aceite de privacidade obrigatório para registrar sugestão;
- criado endpoint administrativo `GET /api/v1/category-suggestions/admin` com paginação;
- criado endpoint administrativo de moderação `PATCH /api/v1/category-suggestions/admin/:id`;
- moderação restrita a `ADMIN`, com transição apenas de `PENDING` para `APPROVED` ou `REJECTED`.

### Administração e frontend

- cadastro profissional passou a exibir o bloco "Não encontrou sua categoria?" com envio independente da criação de conta;
- mensagem de sucesso orienta que o usuário pode continuar o cadastro normalmente;
- `/admin/categorias` passou a exibir terceira seção: "Sugestões públicas de categoria";
- administração pode aprovar ou rejeitar sugestões pendentes;
- itens moderados permanecem no histórico sem novas ações.

### Moderação e auditoria

- `PublicCategorySuggestionStatus` ampliado para `PENDING`, `APPROVED` e `REJECTED`;
- adicionados campos de revisão em `PublicCategorySuggestion`: `reviewNotes`, `reviewedByUserId`, `reviewedAt`;
- sugestão já revisada não pode ser moderada novamente;
- rejeição não remove registro;
- histórico de revisão preservado.

### Operação

- fluxo de sugestões públicas validado em produção.

### Categorias do MVP

- consolidada a lista oficial de 8 categorias do MVP como fonte única no PostgreSQL e na API;
- reforço de que frontend não deve manter listas hardcoded de categorias em fluxos operacionais.

### Modelo de dados

- criada relação many-to-many explícita entre `ProfessionalProfile` e `Category` por meio de `ProfessionalCategory`;
- `ProfessionalCategory` com campos `id`, `professionalProfileId`, `categoryId`, `createdAt`;
- chave única composta em `professionalProfileId + categoryId`;
- vínculo com `ProfessionalProfile` usando `onDelete: Cascade`;
- vínculo com `Category` usando `onDelete: Restrict`.

### Registro profissional

- cadastro com `initialRole = PROFESSIONAL` passou a aceitar `categorySlugs?: string[]` no backend;
- validações de backend aplicadas para profissionais: obrigatório na prática, mínimo 1, máximo 3, sem duplicatas e somente categorias existentes/ativas;
- criação de `User`, `ProfessionalProfile` e `ProfessionalCategory` realizada na mesma transação, sem cadastro parcial em caso de falha;
- cadastro `CUSTOMER` mantido sem obrigação de categorias.

### Frontend

- Home consumindo `GET /api/v1/categories`;
- cadastro profissional consumindo `GET /api/v1/categories`;
- seleção de categorias no cadastro profissional limitada visualmente e por validação entre 1 e 3;
- envio de `categorySlugs` ao backend no cadastro profissional.

### Administração

- documentação consolidada dos endpoints `GET /api/v1/categories/admin` e `GET /api/v1/category-requests/admin`;
- operação mantida na página administrativa `/admin/categorias`.

## 2026-08-12

### Administração

- criada a rota administrativa `/admin/categorias`;
- implementada tela administrativa read-only com duas áreas:
  - categorias oficiais;
  - solicitações de categoria;
- consumo do endpoint `GET /api/v1/categories/admin` com `page` e `pageSize`;
- consumo do endpoint `GET /api/v1/category-requests/admin` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403` por seção;
- paginações independentes entre categorias e solicitações;
- renderização com tabela no desktop e cards no mobile;
- card `Categorias` marcado como disponível no painel `/admin`.

### Backend

- criada a listagem administrativa `GET /api/v1/categories/admin`;
- autenticação via Bearer access token e autorização restrita a `ADMIN`;
- retorno de categorias ativas e inativas com paginação;
- ordenação por `displayOrder` asc e `name` asc;
- campos retornados: `id`, `name`, `slug`, `isActive`, `displayOrder`, `createdAt`, `updatedAt`.

- criada a listagem administrativa `GET /api/v1/category-requests/admin`;
- autenticação via Bearer access token e autorização restrita a `ADMIN`;
- retorno de solicitações de todos os status com paginação;
- ordenação por `createdAt` desc;
- campos principais retornados: `suggestedName`, `status`, `reviewNotes`, `professionalProfile`, `resolvedCategory`, `createdAt`, `reviewedAt`.

### Administração

- criada a rota administrativa `/admin/profissionais`;
- implementada listagem administrativa read-only de profissionais;
- consumo do endpoint `GET /api/v1/users/admin/professionals` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403`;
- paginação com cards no mobile e tabela no desktop;
- card `Profissionais` marcado como disponível no painel `/admin`;
- exibição administrativa de status da conta, verificação profissional e disponibilidade.

## 2026-08-12

### Administração

- criada a rota administrativa `/admin/clientes`;
- implementada listagem administrativa read-only de clientes;
- consumo do endpoint `GET /api/v1/users/admin/customers` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403`;
- paginação com cards no mobile e tabela no desktop;
- card `Clientes` marcado como disponível no painel `/admin`.

## 2026-08-11

### Autenticação

- corrigida a restauração da sessão autenticada após reload e navegação completa;
- refresh token mantido em cookie HttpOnly;
- access token mantido apenas em memória;
- evitadas corridas entre refresh automático, signIn e signOut;
- `GET /api/v1/users/me` ajustado para aceitar a resposta real da API e evitar cache indevido.

### Administração

- criada a rota `/admin/interessados`;
- implementada listagem administrativa paginada de interessados do lançamento;
- proteção visual restrita a usuário autenticado com role `ADMIN`;
- proteção real mantida no backend com `AccessTokenGuard` + `RolesGuard` + `Role.ADMIN`;
- interface com cards no mobile e tabela no desktop;
- estados de loading, vazio, erro, `401` e `403`;
- exibição correta de consentimento e descadastro de marketing;
- rota administrativa marcada como `noindex`.

## 2026-08-10

### Produto / Operação — Curadoria Inicial de Profissionais

- definida estratégia de curadoria inicial assíncrona para profissionais;
- removida entrevista obrigatória para todos os profissionais;
- contato humano passa a ser utilizado por exceção e risco;
- definida curadoria em quatro camadas:
  - cadastro estruturado;
  - verificação básica;
  - evidências + questionário;
  - classificação operacional de risco;
- aprovação/análise passa a ser resultado ou encaminhamento após as quatro camadas;
- presença digital definida como evidência complementar, não obrigatória;
- questionário por categoria não representa certificação técnica;
- CPF/CNPJ passa a ser solicitado somente quando necessário à verificação;
- classificação baixo/moderado/alto registrada como instrumento operacional não automatizado;
- padronização de nomenclatura para análise manual/adicional no piloto;
- não aprovação passa a admitir reavaliação quando aplicável;
- suspensões preventivas deverão possuir motivo registrado e revisão administrativa;
- reforçados princípios de minimização de dados e LGPD;
- nenhuma API, migration, tabela, tela ou automação foi implementada nesta alteração.

## 0.1.2 — Documentação (2026-08-06)
- Incorporada à documentação oficial a estratégia de crescimento orgânico, SEO programático responsável e Hub de Problemas como evolução futura da Soravi.

## 0.1.3 — Consentimento de cookies (2026-08-06)
- Implementado o primeiro estágio do banner de consentimento de cookies com persistência segura em localStorage, opções de aceitar ou recusar analytics e reabertura pelo rodapé.
- Integrado o Google Analytics 4 de forma condicionada ao consentimento do usuário, sem carregar scripts antes da aceitação.

## 0.1.0 — Commit 001: Fundação
- Monorepo
- Web Next.js
- API NestJS
- PostgreSQL e Redis
- Documentação inicial
- Página inicial de entrada.
- Formulário de login com validação de e-mail e senha.
- Controle para mostrar ou ocultar a senha.
- Página de escolha do tipo de conta.
- Jornadas separadas para clientes e profissionais.
- Componente reutilizável para opções de cadastro.
- Formulário inicial de cadastro de cliente.
- Validação de nome, e-mail, telefone e senha.
- Confirmação de senha e aceite dos documentos jurídicos.
- Formulário inicial de cadastro profissional.
- Seleção de categorias e região de atendimento.
- Validação de descrição, contato, senha e documentos jurídicos.
- Estrutura inicial dos Termos de Uso.
- Estrutura inicial da Política de Privacidade.
- Aviso de revisão jurídica pendente nas páginas legais.
- Página inicial de recuperação de senha.
- Validação do e-mail utilizado na solicitação.
- Mensagem neutra para proteção das contas cadastradas.
- Página inicial de redefinição de senha.
- Validação de senha segura e confirmação.
- Verificação da presença do token de recuperação.
- Aplicação da logo oficial da Soravi no Header e no Footer.
- Inclusão dos ativos iniciais da identidade visual.
- Configuração inicial segura da API.
- Prefixo global `/api/v1`.
- Validação de entradas e variáveis de ambiente.
- CORS restrito e cabeçalhos de segurança.
- Health Check padronizado.
- Correção das mensagens de validação da autenticação.
- Login ajustado para responder com HTTP 200.
- Registro da data do último login válido.
- Tratamento separado para e-mail e telefone duplicados.
- Regra de senha alinhada entre frontend e backend.
- Emissão inicial de access token e refresh token no login.
- Criação de sessão autenticada no PostgreSQL.
- Armazenamento protegido do hash do refresh token.
- Configuração de validade dos tokens por variáveis de ambiente.
- Renovação de access token com rotação segura do refresh token.
- Prevenção de reutilização de refresh tokens antigos.
- Encerramento de sessão por logout.
- Revogação de sessões no PostgreSQL.
- Testes automatizados de refresh e logout.
- Validação de access token JWT em rotas protegidas.
- Verificação da sessão autenticada no PostgreSQL.
- Invalidação de access tokens vinculados a sessões revogadas ou expiradas.
- Criação da rota protegida `GET /api/v1/users/me`.
- Testes automatizados do guard JWT e do controller de usuários.
- Autorização de rotas por papéis de usuário.
- Criação do decorator `@Roles`.
- Criação do `RolesGuard`.
- Resposta `INSUFFICIENT_PERMISSIONS` para acessos não autorizados.
- Validação de acesso profissional com testes automatizados.
- Criação do modelo de categorias de serviços.
- Criação do fluxo de solicitações de novas categorias por profissionais.
- Inclusão dos estados `PENDING`, `APPROVED`, `REJECTED` e `MERGED`.
- Estrutura para análise administrativa e vinculação a categorias existentes.
- Regra de que a ausência de categoria não impede o cadastro profissional.- Suporte à porta dinâmica de hospedagem com prioridade em `PORT`.
- Escuta explícita em `0.0.0.0` no servidor da API.
- Novo script `prisma:migrate:deploy` para implantações.
- Validação obrigatória de `DATABASE_URL` no ambiente.
- Consolidação do `apps/api/package.json` em um único `devDependencies`.## Autenticação e autorização

- Cadastro seguro de clientes e profissionais.
- Login com hash de senha Argon2id.
- Emissão de access token e refresh token.
- Criação de sessões autenticadas no PostgreSQL.
- Rotação segura de refresh tokens.
- Prevenção de reutilização de refresh tokens antigos.
- Logout com revogação da sessão.
- Validação de access token e sessão.
- Criação da rota protegida `GET /api/v1/users/me`.
- Autorização por papéis com `@Roles` e `RolesGuard`.
- Resposta `INSUFFICIENT_PERMISSIONS` para acessos não autorizados.

## Categorias

- Criação do modelo de categorias de serviços.
- Criação do fluxo de solicitações de novas categorias.
- Inclusão dos estados `PENDING`, `APPROVED`, `REJECTED` e `MERGED`.
- Estrutura para revisão por administradores ou moderadores.
- Possibilidade de vincular solicitações a categorias existentes.
- Regra de que a ausência de categoria não impede o cadastro profissional.

## Categorias de serviços

- Criação do módulo de categorias.
- Criação da rota pública `GET /api/v1/categories`.
- Listagem exclusiva de categorias ativas.
- Ordenação por ordem de exibição e nome.
- Retorno de dados públicos por DTO.
- Testes automatizados do service e controller.

## Carga inicial de categorias

- Criação de seed idempotente para categorias oficiais.
- Inclusão de oito categorias iniciais de serviços.
- Atualização de registros existentes por `slug`.
- Prevenção de categorias duplicadas em execuções repetidas.
- Validação da carga pela rota pública `GET /api/v1/categories`.

## 0.1.1 — Pré-lançamento (2026-08-05)
- Modelagem Prisma `LaunchInterest` para pré-cadastro de interesse no lançamento (sem criação de conta).
- Implementação da API pública `POST /api/v1/launch-interests` para registrar interesse no lançamento com normalização de e-mail, consentimento de privacidade e operação idempotente por e-mail normalizado.
- Adição de formulário de interesse no lançamento na página inicial com validação, envio seguro e mensagem de sucesso amigável.

## 2026-08-08

### Cadastro de cliente
- Conexão do formulário de cadastro de cliente à API real `POST /api/v1/auth/register`.
- Alinhamento das regras de senha com o backend: mínimo de 12 caracteres, máximo de 128, ao menos uma letra e um número.
- Introdução do versionamento inicial de Termos de Uso e Política de Privacidade com versão `1.0` para o formulário.

### Administração
- Criação da primeira etapa administrativa do painel de pré-cadastros com `GET /api/v1/launch-interests`.
- Proteção por `AccessTokenGuard` e `RolesGuard`, com `@Roles(Role.ADMIN)`.
- Consulta paginada com `page`, `pageSize`, total e `createdAt` em ordem decrescente.
- Exclusão de colunas sensíveis (`emailNormalized` e `phoneNormalized`) da resposta de consulta.

## 2026-08-07

### Produção e infraestrutura

- Publicado o backend NestJS da Soravi no Render.
- Criado PostgreSQL gerenciado de produção no Render.
- Configurada a API e o banco na região Virginia (US East).
- Configuradas variáveis de ambiente de produção para:
  - `NODE_ENV`;
  - `DATABASE_URL`;
  - `CORS_ORIGIN`;
  - `JWT_ACCESS_SECRET`;
  - `JWT_ACCESS_EXPIRES_IN_SECONDS`;
  - `JWT_REFRESH_EXPIRES_IN_DAYS`.
- Configurado health check da API em `/api/v1/health`.
- Configurado pre-deploy com `prisma migrate deploy`.
- Corrigido o script de inicialização da API para usar `dist/src/main.js`.
- Validado o build da API em ambiente de produção.
- Aplicadas com sucesso as migrations do PostgreSQL de produção.
- Conectado o frontend publicado na Vercel à API pública no Render.
- Validado o envio do formulário “Acompanhe o lançamento” em produção.
- Confirmada a persistência dos dados na tabela `launch_interests`.
- Validado o fluxo completo:
  - Vercel;
  - API NestJS no Render;
  - PostgreSQL no Render.

### Analytics e privacidade

- Publicado o banner de consentimento de cookies.
- Implementado Google Analytics 4 condicionado ao consentimento do usuário.
- Analytics permanece bloqueado antes da aceitação.
- Implementada revogação do consentimento com remoção dos cookies `_ga`.
- Configurada a variável `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` na Vercel.
- Validado o carregamento da tag GA4 em produção somente após o aceite.
