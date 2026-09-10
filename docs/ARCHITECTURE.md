# 03 — Arquitetura Técnica

## 1. Objetivo

Este documento define a arquitetura técnica oficial da Soravi para o desenvolvimento do MVP.

## Estado de segurança implementado — 2026-09-07

- O access token é curto e cada request autenticado valida também a sessão no PostgreSQL.
- `phoneVerifiedAt` é obtido do banco durante a autenticação do request; não existe claim de verificação de telefone no JWT.
- `PhoneVerifiedGuard` é declarado explicitamente apenas nos handlers sensíveis. Leituras privadas continuam autenticadas sem essa exigência, e `ADMIN` permanece temporariamente dispensado.
- A verificação de telefone mantém challenges com código protegido por HMAC, expiração, tentativas e invalidação. `PhoneVerificationDeliveryPort` desacopla a entrega; há adapter Meta selecionável por configuração, ainda não operacional em produção.
- A infraestrutura Meta possui número oficial dedicado à Soravi, WABA e registro do número na WhatsApp Cloud API. O template pretendido `codigo_verificacao_soravi` é `AUTHENTICATION`, `pt_BR`, com ação `COPY_CODE` e expiração de 10 minutos, mas sua criação foi recusada por falta de permissão da WABA. Portanto, não há template criado ou aprovado nem entrega real de OTP.
- O webhook da Meta ainda não foi configurado nem assinado e não está operacional em produção. Sua configuração será retomada quando o delivery Meta estiver apto a avançar; até lá, o provider não deve ser ativado em produção.
- A alteração de telefone bloqueia o usuário e ocorre em transação: valida a senha atual, normaliza o número, zera `phoneVerifiedAt` em mudança real, invalida challenges, preserva a sessão atual e revoga as demais.
- A recuperação usa `PasswordResetDeliveryPort` fail-closed, com adapter Resend como provider real atual e possibilidade de substituição futura. Tokens opacos de 256 bits são entregues em base64url, persistidos somente como SHA-256 e mantidos raw apenas em memória durante o delivery.
- A confirmação do reset bloqueia `User` antes de `PasswordResetToken` e, na mesma transação, atualiza o hash Argon2id, consome o token utilizado, invalida os demais tokens ativos e revoga todas as sessões.
- O frontend recebe o token em `/redefinir-senha#token=<token>`, lê e remove o fragmento somente no client e mantém o token apenas em memória. O fluxo não persiste credenciais ou tokens e retorna ao login sem auto-login.
- A troca administrativa de senha também invalida tokens de reset pendentes dentro de sua transação.
- A troca de senha autenticada foi concluída de ponta a ponta nos commits `f8ea104 feat(users): permite alterar a propria senha` e `777732b feat(web): adiciona seguranca da conta`. O backend expõe `PATCH /api/v1/users/me/password`, usa `userId` e `sessionId` do contexto autenticado, exige senha atual correta e nova senha diferente, aplica a política central 12 a 128 com bloqueio de senhas comuns, não trima/normaliza/trunca senhas, bloqueia o usuário com `SELECT ... FOR UPDATE`, gera hash Argon2id, invalida tokens pendentes de password reset, revoga somente as outras sessões e preserva a sessão atual, tudo na mesma transação e sem migration/schema.
- A rota frontend `/conta/seguranca` é autenticada, está disponível para CUSTOMER, PROFESSIONAL e ADMIN, inclusive quando `phoneVerified=false`, e tem link `Conta` no header autenticado desktop/mobile. O formulário envia apenas senha atual e nova senha; a confirmação fica somente no frontend. Códigos públicos de erro são tratados explicitamente, mensagens arbitrárias do backend não são exibidas, e em `401` os campos de senha são apagados antes do refresh da sessão, sem retry automático.
- A política oficial de senha foi centralizada no backend no commit `5d204a0 fix(auth): centraliza politica segura de senha` e alinhada no frontend no commit `ce06e44 fix(web): alinha formularios a politica de senha`: mínimo de 12 e máximo de 128 caracteres, sem exigência obrigatória de letra, número, maiúscula, minúscula ou símbolo; qualquer composição nesse intervalo é permitida.
- A senha original nunca deve ser trimada, normalizada ou truncada antes de hashing ou verificação. O hashing permanece com Argon2id, senhas comuns são bloqueadas no backend e o login de contas existentes não aplica retroativamente a nova política.
- A blocklist versionada contém exatamente 3000 entradas derivadas do SecLists, é mantida somente no backend, usa lookup case-insensitive apenas para detecção e não modifica a senha original. A atribuição e o snapshot estão documentados em `apps/api/src/modules/auth/password-policy/ATTRIBUTION.md`; a documentação não copia as 3000 senhas.
- O frontend não contém a blocklist, valida somente estrutura 12 a 128 caracteres e trata `PASSWORD_TOO_COMMON` retornado pelo backend.
- ASVS 5.0.0 V6.2.2 (usuário autenticado alterar a própria senha), V6.2.3 (troca de senha exigir senha atual + nova), V6.2.4 (rejeição de senhas comuns) e V6.2.5 (remoção das regras obrigatórias de composição) estão tratados por esses commits, sem declarar conformidade ASVS geral.
- O hardening de dependências reduziu o baseline de `npm audit --omit=dev` de 14 para 6 vulnerabilidades por atualizações compatíveis: Next.js 15.5.25, `qs` 6.16.0, `sharp` 0.35.4, `fast-uri` 3.1.7, `nanoid` 3.3.18 e Prisma/`@prisma/client` 7.10.0. O Prisma 7.10.0 também removeu Hono e `@hono/node-server` da árvore vulnerável e atualizou `valibot` para 1.4.2.
- As 6 vulnerabilidades residuais são risco conhecido e monitorado, concentrado em `deepmerge-ts` 7.1.5, dependência interna de `@prisma/config`; `mysql2` 3.15.3, dependência interna do Prisma/tooling embora a Soravi use PostgreSQL; e `postcss` 8.4.31, fixado internamente pelo Next.js 15.5.25. Não foram usados `npm audit fix --force` ou overrides internos sem validação de compatibilidade.
- Em 2026-09-03, o frontend passou a remover `X-Powered-By` e a enviar `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`; `Strict-Transport-Security` é enviado somente em produção.
- Em 2026-09-04, o commit técnico `40f766f feat(web): adiciona nonce dinamico ao CSP` concluiu o hardening de `script-src`. A CSP continua exclusivamente em `Content-Security-Policy-Report-Only`, sem CSP bloqueante ativa no navegador. O middleware gera um nonce criptograficamente imprevisível por requisição, coloca-o nos request headers internos para o Next.js e o mesmo valor é aplicado aos scripts renderizados, inclusive aos dois componentes `next/script` do Google Analytics.
- `script-src` não usa mais `'unsafe-inline'`: usa nonce e `'strict-dynamic'`. A CSP de production não permite `'unsafe-eval'`; posteriormente, o modo Report-Only detectou uma tentativa de geração dinâmica de código/JIT pelo Zod 4.4.3. O commit técnico `c755262 feat(web): configura Zod sem JIT para CSP` criou `apps/web/lib/zod.ts`, configurou `z.config({ jitless: true })` antes da criação dos schemas e centralizou nele os imports diretos de Zod do frontend, sem alterar schemas, mensagens ou regras de negócio. A violação anteriormente observada deixou de aparecer em `/solicitacoes/nova` no teste local em production, sem adicionar `'unsafe-eval'` à política.
- A política continua permitindo explicitamente API, WebSocket equivalente, ViaCEP, Google Analytics e a origin específica do R2 `https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com`, sem wildcard ou `https:` genérico. HSTS permanece condicionado a production. O nonce no header CSP, sua mudança entre requisições, sua presença no HTML, a entrega exclusiva de Report-Only e o HSTS local em production foram validados, assim como TypeScript, ESLint direcionado, build do frontend e `git diff --check`.
- O commit técnico `83b25bf feat(web): restringe estilos inline no CSP` substituiu `style-src 'self' 'unsafe-inline'` por `style-src 'self'`, `style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`, sem alterar `script-src` ou nonce. O diagnóstico encontrou zero tags `<style>` no HTML inicial e no DOM observado; atributos `style=""` ainda são gerados em runtime, inclusive por elementos internos do Next.js/Next Image, por isso `'unsafe-inline'` permanece temporariamente restrito a atributos.
- A CSP permanece exclusivamente Report-Only, sem enforcement ativo, wildcard ou `https:` genérico. O nonce por requisição tornou as páginas server-rendered dinamicamente e esse trade-off de cache/performance deve ser monitorado. Não houve afirmação de deploy em produção. `style-src-attr 'unsafe-inline'`, revisão adicional de sessões/tokens e cookies/refresh conforme o [backlog pré-beta](07-backlog.md#hardening-de-sessão-pré-beta), rate limits, revisão OWASP ASVS e a avaliação futura de CSP bloqueante continuam pendentes.

A arquitetura deve permitir:

* desenvolvimento rápido e incremental;
* separação clara de responsabilidades;
* segurança desde o início;
* facilidade de manutenção e testes;
* evolução sem complexidade prematura;
* crescimento gradual da plataforma.

A Soravi será construída inicialmente como um **monólito modular**, com frontend, backend, banco de dados e armazenamento de arquivos separados por responsabilidade.

---

## 2. Princípios arquiteturais

Todas as decisões técnicas devem respeitar os seguintes princípios:

1. Simplicidade antes de complexidade.
2. Regras de negócio concentradas no backend.
3. PostgreSQL como fonte principal de dados.
4. Redis somente quando houver necessidade concreta.
5. Segurança e privacidade consideradas desde o início.
6. Componentes e módulos com responsabilidades bem definidas.
7. Dependências entre módulos mantidas sob controle.
8. Desenvolvimento incremental, commit por commit.
9. Observabilidade e tratamento de erros desde o MVP.
10. Microsserviços somente quando houver evidência real de necessidade.

---

## 3. Arquitetura geral

A Soravi será composta inicialmente por:

```text
Usuário
   │
   ▼
Frontend — Next.js
   │
   │ HTTPS / REST API / WebSocket
   ▼
Backend — NestJS
   │
   ├── PostgreSQL
   ├── Armazenamento de arquivos
   └── Redis, quando necessário
```

### Responsabilidades

#### Frontend

Responsável por:

* interface do usuário;
* navegação;
* formulários;
* validações para experiência de uso;
* consumo da API;
* apresentação de erros e estados de carregamento;
* comunicação em tempo real com o backend.

O frontend não deve acessar diretamente o banco de dados.

#### Backend

Responsável por:

* autenticação;
* autorização;
* regras de negócio;
* validação definitiva das entradas;
* controle das transições de estado;
* persistência dos dados;
* envio de notificações;
* comunicação em tempo real;
* auditoria e moderação.

#### PostgreSQL

Será a fonte oficial e permanente dos dados da plataforma.

#### Redis

Será utilizado apenas para necessidades temporárias ou distribuídas, como:

* rate limiting;
* filas;
* cache;
* presença online;
* comunicação entre instâncias;
* eventos em tempo real;
* controle temporário de sessões, quando necessário.

Redis não deve ser a única fonte de informações importantes para o negócio.

#### Armazenamento de arquivos

Será utilizado para:

* fotos de perfil;
* imagens de solicitações;
* arquivos permitidos futuramente;
* conteúdos enviados pelos usuários.

Os arquivos não serão armazenados diretamente no PostgreSQL.

---

## 4. Estilo arquitetural

### 4.1 Monólito modular

O backend será desenvolvido como um monólito modular.

Cada domínio da plataforma terá seu próprio módulo, com responsabilidades bem definidas.

Todos os módulos serão executados inicialmente dentro da mesma aplicação NestJS e utilizarão o mesmo banco PostgreSQL.

### Vantagens para o MVP

* menor complexidade operacional;
* desenvolvimento mais rápido;
* facilidade de testes;
* transações mais simples;
* menor custo de infraestrutura;
* facilidade de depuração;
* deploy centralizado do backend.

### Microsserviços

A Soravi não adotará microsserviços durante o MVP.

Uma futura divisão somente deverá ser considerada quando houver evidências como:

* necessidade de escalabilidade independente;
* gargalos comprovados;
* equipes separadas por domínio;
* ciclos de deploy incompatíveis;
* necessidade de isolamento operacional;
* alto volume em um módulo específico.

Qualquer migração futura deverá ser registrada como decisão arquitetural.

---

## 5. Stack técnica oficial

### 5.1 Frontend

* Next.js;
* React;
* TypeScript;
* Tailwind CSS;
* shadcn/ui;
* Lucide Icons;
* React Hook Form;
* Zod;
* TanStack Query.

### 5.2 Backend

* NestJS;
* TypeScript;
* Prisma ORM;
* PostgreSQL;
* JWT;
* WebSockets;
* Redis, quando necessário.

### 5.3 Infraestrutura

* GitHub;
* Docker;
* Vercel para o frontend;
* serviço gerenciado compatível com Docker para o backend;
* PostgreSQL gerenciado;
* armazenamento de arquivos compatível com S3;
* Redis gerenciado, quando necessário;
* serviço de monitoramento de erros.

---

## 6. Organização do repositório

A Soravi deverá evoluir para uma estrutura de monorepo.

Estrutura recomendada:

```text
soravi/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── public/
│   │
│   └── api/
│       ├── src/
│       │   ├── common/
│       │   ├── config/
│       │   ├── modules/
│       │   └── main.ts
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
│
├── packages/
│   ├── eslint-config/
│   ├── typescript-config/
│   └── contracts/
│
├── docs/
├── docker/
├── .github/
├── package.json
└── README.md
```

A reorganização deverá ser incremental.

O projeto Next.js já existente não deverá ser descartado. Ele deverá ser movido ou adaptado com segurança quando a estrutura de monorepo for implementada.

---

## 7. Organização do frontend

### Diretórios principais

#### `app`

Responsável por:

* rotas;
* layouts;
* páginas;
* loading states;
* error boundaries;
* componentes de rota.

#### `components`

Componentes reutilizáveis e genéricos da interface.

Exemplos:

* Button;
* Input;
* Modal;
* Avatar;
* Badge;
* Header;
* Footer.

#### `features`

Organização das funcionalidades por domínio.

Exemplos:

```text
features/
├── auth/
├── professionals/
├── service-requests/
├── proposals/
├── conversations/
└── notifications/
```

Cada feature poderá possuir:

```text
feature/
├── components/
├── hooks/
├── schemas/
├── services/
├── types/
└── utils/
```

#### `hooks`

Hooks reutilizáveis que não pertencem a uma única funcionalidade.

#### `lib`

Configurações e utilidades gerais.

Exemplos:

* cliente HTTP;
* configuração do TanStack Query;
* formatação;
* utilidades de autenticação;
* validações compartilhadas.

#### `types`

Tipos globais do frontend.

### Regras do frontend

* utilizar Server Components quando apropriado;
* utilizar Client Components somente quando necessário;
* não duplicar regras críticas do backend;
* validar formulários com React Hook Form e Zod;
* tratar estados de carregamento, erro e ausência de dados;
* manter interfaces mobile-first;
* respeitar WCAG 2.1 nível AA;
* evitar componentes excessivamente grandes;
* não armazenar credenciais sensíveis no código.

---

## 8. Organização do backend

O backend será organizado por módulos de domínio.

Estrutura inicial recomendada:

```text
modules/
├── auth/
├── users/
├── customer-profiles/
├── professional-profiles/
├── categories/
├── service-requests/
├── proposals/
├── contracts/
├── conversations/
├── messages/
├── reviews/
├── favorites/
├── notifications/
├── uploads/
├── verification/
├── moderation/
└── admin/
```

### Estrutura interna de um módulo

```text
module/
├── controllers/
├── services/
├── dto/
├── entities/
├── guards/
├── policies/
├── validators/
├── repositories/
└── module.ts
```

Nem todos os módulos precisarão de todos esses diretórios.

A estrutura deverá ser criada conforme a necessidade real de cada funcionalidade.

### Responsabilidades

#### Controllers

Responsáveis por:

* receber requisições;
* validar parâmetros básicos;
* chamar os serviços;
* retornar respostas HTTP.

Controllers não devem concentrar regras de negócio.

#### Services

Responsáveis por:

* executar casos de uso;
* aplicar regras de negócio;
* coordenar acesso aos dados;
* controlar transações;
* produzir erros de domínio.

#### DTOs

Responsáveis por:

* definir entradas e saídas;
* validar dados;
* documentar contratos da API.

#### Guards e Policies

Responsáveis por:

* autenticação;
* autorização por papel;
* autorização por propriedade do recurso;
* verificação de permissões específicas.

#### Repositories

Poderão ser utilizados quando ajudarem a isolar consultas complexas ou regras de persistência.

Não devem ser criados apenas como abstração artificial sobre o Prisma.

---

## 9. Módulos principais do domínio

### Auth

Responsável por:

* cadastro;
* login;
* logout;
* refresh token;
* recuperação de senha;
* redefinição de senha;
* verificação de e-mail;
* gerenciamento de sessões.

### Users

Responsável pela identidade principal do usuário.

Um usuário poderá possuir mais de um papel na plataforma.

Exemplo:

* cliente;
* profissional;
* administrador;
* moderador.

### Customer Profiles

Responsável pelos dados específicos do cliente.

### Professional Profiles

Responsável por:

* descrição profissional;
* categorias atendidas;
* área de atendimento;
* verificação;
* reputação;
* dados públicos do profissional.

### Categories

Responsável pelas categorias de serviços.

### Service Requests

Responsável pelas solicitações criadas pelos clientes.

### Proposals

Responsável pelas propostas enviadas pelos profissionais.

Um profissional poderá manter apenas uma proposta ativa por solicitação.

### Contracts

Responsável pela contratação resultante do aceite de uma proposta.

A contratação deverá ser uma entidade própria.

Ela será usada para:

* registrar a proposta aceita;
* preservar as condições acordadas;
* liberar a conversa;
* iniciar o serviço;
* concluir o serviço;
* cancelar a contratação;
* permitir avaliação.

### Conversations e Messages

Responsáveis pelo chat entre cliente e profissional.

No MVP, o chat será liberado somente após o aceite da proposta.

### Reviews

Responsável pelas avaliações após a conclusão do serviço.

### Favorites

Responsável por permitir que clientes salvem profissionais.

### Notifications

Responsável pelas notificações persistentes da plataforma.

Notificações em tempo real serão adicionadas somente quando necessárias.

### Uploads

Responsável por validar e autorizar o envio de arquivos.

### Verification

Responsável pela verificação básica de usuários e profissionais.

### Moderation

Responsável por denúncias, bloqueios e ações de moderação.

### Admin

Responsável pelas funções administrativas e indicadores da plataforma.

---

## 10. Banco de dados

### Fonte principal

PostgreSQL será a única fonte oficial para os dados permanentes de negócio.

Exemplos:

* usuários;
* perfis;
* solicitações;
* propostas;
* contratações;
* conversas;
* mensagens;
* avaliações;
* notificações;
* ações administrativas.

### Prisma ORM

Prisma será utilizado para:

* definição do schema;
* migrations;
* consultas;
* transações;
* seeds;
* acesso tipado ao banco.

### Regras

* migrations devem ser versionadas;
* alterações de schema devem ser revisadas;
* produção não deve utilizar `prisma db push`;
* migrations de produção devem ser executadas de forma controlada;
* índices devem ser definidos conforme os padrões de consulta;
* exclusões sensíveis devem considerar soft delete;
* datas devem ser armazenadas em UTC;
* dinheiro deve ser armazenado em unidade inteira, como centavos;
* IDs deverão utilizar UUID, CUID ou padrão oficialmente definido no modelo de dados.

---

## 11. Estados e transições de negócio

Estados importantes deverão ser controlados pelo backend.

Não será permitido alterar livremente estados críticos por meio de um endpoint genérico.

### Exemplos de ações explícitas

```text
POST /service-requests/{id}/publish
POST /service-requests/{id}/cancel

POST /proposals/{id}/accept
POST /proposals/{id}/withdraw

POST /contracts/{id}/start
POST /contracts/{id}/complete
POST /contracts/{id}/cancel
```

Cada transição deverá validar:

* usuário autenticado;
* papel permitido;
* propriedade do recurso;
* estado atual;
* transição solicitada;
* regras adicionais do domínio.

As transições oficiais serão detalhadas no documento de regras de negócio e no modelo de dados.

---

## 12. API

A API seguirá os seguintes padrões:

* REST;
* JSON;
* UTF-8;
* HTTPS obrigatório;
* versionamento por `/api/v1`;
* documentação OpenAPI/Swagger;
* autenticação via JWT;
* respostas de erro padronizadas;
* paginação em endpoints de listagem;
* filtros explicitamente permitidos;
* validação de todas as entradas.

### Padrão de erro

Exemplo:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Os dados enviados são inválidos.",
  "details": [
    {
      "field": "email",
      "message": "Informe um e-mail válido."
    }
  ],
  "requestId": "identificador-da-requisicao"
}
```

A API não deverá expor:

* stack traces;
* mensagens internas do banco;
* detalhes de infraestrutura;
* segredos;
* informações sensíveis.

---

## 13. Autenticação e sessões

A autenticação implementada é baseada em:

* access token de curta duração;
* refresh token com rotação;
* sessões registradas;
* revogação de sessão;
* recuperação de senha com token temporário.

### Política de sessão implementada

Os commits `e4210b9`, `e3000fd`, `14734d3`, `eecb5d6`, `e70392e`, `96abdd6`, `fa63449`, `0e2b376`, `5d204a0`, `ce06e44`, `f8ea104` e `777732b` concluíram os hardenings abaixo. As validações de conclusão estão no [changelog](../CHANGELOG.md); este estado não afirma deploy em produção nem conformidade ASVS geral.

| Prazo | Política |
| --- | --- |
| Access token | 15 minutos por padrão, comportamento já existente. |
| Refresh idle/sliding timeout | 30 dias por padrão, comportamento já existente. |
| Lifetime absoluto da `AuthSession` | 90 × 24 horas desde `AuthSession.createdAt`. |
| Sessões simultâneas | máximo de 5 `AuthSession` ativas por conta (CUSTOMER, PROFESSIONAL e ADMIN). |
| Rate limit de login | 10 requisições / 15 minutos via `ThrottlerGuard`. |
| Rate limit de refresh | 60 requisições / 15 minutos via `ThrottlerGuard`. |
| Senhas | 12 a 128 caracteres, sem composição obrigatória; senhas comuns bloqueadas pelo backend. |
| Troca de senha autenticada | `PATCH /api/v1/users/me/password`, 3 tentativas por hora, sessão atual preservada e demais sessões revogadas. |

O limite absoluto é calculado como `createdAt.getTime() + 90 * 24 * 60 * 60 * 1000`, por timestamp/milissegundos, sem cálculo por calendário. O `expiresAt` efetivo é o menor entre a expiração deslizante do refresh e esse limite. Nenhuma renovação pode ultrapassar `createdAt + 90 dias`; ao atingir 90 dias desde a criação, novo login é obrigatório. Refresh e autenticação por access token rejeitam sessões cujo lifetime absoluto terminou, inclusive sessões já existentes. `AuthSession.createdAt` já existia, portanto não houve alteração de schema nem migration. Login e refresh devolvem ao cookie exatamente o `expiresAt` efetivamente persistido.

O refresh token é gerado criptograficamente e somente seu hash SHA-256 é persistido. A rotação invalida o token antigo e preserva a proteção concorrente por `id` + `refreshTokenHash` + `revokedAt` + `expiresAt`. O logout revoga a `AuthSession` no banco. O access token contém `sessionId`, e a sessão é consultada no PostgreSQL durante a autenticação; sessões revogadas ou expiradas são rejeitadas.

No login, no máximo 5 `AuthSession` ativas são mantidas por conta: ao ultrapassar o limite, as sessões ativas mais antigas são revogadas, em ordem determinística por `createdAt` e depois `id`. Sessões já revogadas, expiradas ou além do lifetime absoluto não contam para o limite. O login usa transação interativa e a atualização real do `User` como ponto de serialização; após obter esse lock, `passwordHash`, `status` e `deletedAt` são revalidados, e o login é rejeitado se o `passwordHash` mudou desde a validação inicial (por exemplo, reset de senha concorrente). O Argon2 continua fora da transação. A recuperação de senha já usa `SELECT ... FOR UPDATE` e revoga as sessões do usuário. A suíte PostgreSQL integrada cobre concorrência real entre login e bloqueio administrativo, login e confirmação de password reset e o limite máximo de sessões sob logins concorrentes; login versus troca de senha autenticada e os demais cenários ainda não implementados permanecem pendentes.

`POST /auth/login` e `POST /auth/refresh` possuem rate limit via `ThrottlerGuard` (10 e 60 requisições / 15 minutos, respectivamente). O armazenamento do contador é em memória do processo, sem Redis nem storage compartilhado entre instâncias; a coordenação do limite ao escalar horizontalmente permanece como pendência de revisão.

No frontend, o refresh mantém single-flight por Promise dentro da mesma aba; entre abas, quando disponível, é usado o Web Lock nomeado `soravi-auth-refresh`. Nenhuma credencial é armazenada em `localStorage`/`sessionStorage` e nenhum token é transmitido por `BroadcastChannel`. Sem suporte a Web Locks, o fallback preserva o comportamento anterior, sem afirmar suporte universal da API pelos navegadores.

A tabela `auth_refresh_token_history` (migration `20260906000100_create_auth_refresh_token_history`, aplicada e validada somente no PostgreSQL local; produção não foi alterada) registra cada rotação de refresh token vinculada à `AuthSession`, guardando apenas o hash do token (nunca o token bruto), `rotatedAt`, `expiresAt` e `replayedAt`. O CAS da `AuthSession` e a criação desse histórico ocorrem na mesma transação interativa, de forma atômica; um token já rotacionado nunca volta a ser válido e sua reutilização sempre responde `401`. Até exatamente 60 segundos desde `rotatedAt`, a reutilização responde `401` sem revogar a sessão. Após esse grace period, se o token ainda estaria dentro de sua validade original e a sessão segue ativa, a reutilização é tratada como replay suspeito: o histórico é marcado com `replayedAt` e somente aquela `AuthSession` é revogada — nunca todas as sessões da conta. Token aleatório/não encontrado, histórico expirado ou sessão já revogada/expirada/além do lifetime absoluto respondem `401` sem revogação adicional; a resposta pública não diferencia replay de token inválido.

### Moderação administrativa de status implementada

Os commits `fce91dc feat(admin): adiciona bloqueio seguro de contas` e `7f7b5dd feat(admin): adiciona moderacao de contas no painel` implementaram a moderação `ACTIVE`/`BLOCKED`, sem afirmar deploy. `PATCH /api/v1/users/admin/:userId/status` aceita somente esses dois status e retorna `204 No Content`. O controller usa `AccessTokenGuard`, `RolesGuard` e `Role.ADMIN`, valida o alvo como UUID, obtém o ator do contexto autenticado e não exige telefone verificado.

O fluxo atua apenas sobre CUSTOMER e PROFESSIONAL. Self-target e qualquer alvo ADMIN retornam `403`; conta inexistente ou soft-deleted retorna `404`; `PENDING`, `SUSPENDED` e `DEACTIVATED` não participam. O service também valida o status solicitado, independentemente do DTO.

A linha de `User` é carregada com `SELECT ... FOR UPDATE`. Na mesma transação Prisma, `ACTIVE -> BLOCKED` atualiza o status e preenche `revokedAt` de todas as sessões ainda ativas; `BLOCKED -> BLOCKED` preserva o usuário e revoga sessões residuais. `BLOCKED -> ACTIVE` não restaura nem cria sessões, e `ACTIVE -> ACTIVE` é no-op. Em defesa em profundidade, o `AccessTokenAuthService` continua rejeitando usuário `BLOCKED`.

A existência de `Role.ADMIN` no alvo é verificada no mesmo fluxo transacional. O lock atual protege a linha de `User`, mas não `user_roles`; caso promoção ou rebaixamento concorrente de ADMIN seja implementado no futuro, essa concorrência deverá ser revisada.

O frontend reutiliza uma ação compartilhada nas listagens de clientes e profissionais, em mobile e desktop. A ação existe somente para `ACTIVE`/`BLOCKED`, exige confirmação inline e atualiza apenas `item.status` após sucesso, sem reload nem novo fetch obrigatório. Mensagens arbitrárias do backend não são exibidas; códigos públicos e status HTTP são convertidos em mensagens sanitizadas.

ASVS 5.0.0 V7.4.2 está **parcialmente tratado**. A cobertura atual é a revogação explícita de todas as sessões ao entrar ou permanecer em `BLOCKED`. Permanecem pendentes fluxos próprios de `SUSPENDED`, `DEACTIVATED` e exclusão/soft-delete com revogação explícita; somente depois deles será possível avaliar V7.4.2 como integralmente tratado.

### Política de senha implementada

O backend é a autoridade da política de senha. A regra oficial aceita senhas com mínimo de 12 e máximo de 128 caracteres, sem exigência obrigatória de letra, número, maiúscula, minúscula ou símbolo. Qualquer composição entre 12 e 128 caracteres é permitida, desde que não esteja na lista de senhas comuns bloqueadas pelo backend. Senhas nunca devem ser trimadas, normalizadas ou truncadas antes de hashing ou verificação; o hash permanece Argon2id. Login de contas existentes não aplica retroativamente a nova política.

A blocklist possui exatamente 3000 entradas derivadas do SecLists, é versionada e mantida somente no backend. O lookup é case-insensitive apenas para detecção e não altera a senha original. A atribuição e o snapshot estão documentados em `apps/api/src/modules/auth/password-policy/ATTRIBUTION.md`; as entradas da lista não devem ser copiadas para a documentação.

O frontend não contém a blocklist. Ele valida somente a estrutura 12 a 128 caracteres e trata o erro `PASSWORD_TOO_COMMON` quando retornado pelo backend.

ASVS 5.0.0 V6.2.4 (rejeição de senhas comuns) e V6.2.5 (remoção das regras obrigatórias de composição) estão tratados pelos commits `5d204a0` e `ce06e44`, sem declarar conformidade ASVS geral.

### Troca de senha autenticada implementada

`PATCH /api/v1/users/me/password` permite que o usuário autenticado altere a própria senha com body estrito contendo somente `currentPassword` e `newPassword`. O endpoint retorna `204 No Content`, usa `AccessTokenGuard` e `ThrottlerGuard` com limite de 3 tentativas por hora, e não usa `PhoneVerifiedGuard`.

O controller passa ao service apenas `currentUser.id`, `currentUser.sessionId` e o DTO validado; `userId` e `sessionId` nunca são aceitos do body, query ou params. Dentro de uma transação interativa, o usuário é bloqueado com `SELECT ... FOR UPDATE`; depois do lock, a senha atual é verificada. Se a senha atual estiver incorreta, a política da nova senha, o hash e os updates não são executados. A nova senha deve ser diferente da atual, passa pela política central 12 a 128 com bloqueio de senhas comuns, e não é trimada, normalizada ou truncada antes do Argon2id.

Na mesma transação, o `passwordHash` é atualizado, todos os `PasswordResetToken` pendentes são marcados como usados e todas as outras `AuthSession` ativas do usuário são revogadas com o mesmo timestamp. A sessão que realizou a alteração não é revogada nem atualizada. Nenhuma migration ou alteração de schema foi necessária.

No frontend, `/conta/seguranca` é rota autenticada para CUSTOMER, PROFESSIONAL e ADMIN. O link `Conta` aparece no header autenticado desktop/mobile antes de `Sair`. O formulário contém senha atual, nova senha e confirmação da nova senha; a confirmação existe somente no frontend e não é enviada à API. A validação estrutural reutiliza 12 a 128 sem composição obrigatória, e a blocklist permanece somente no backend.

Os códigos públicos `INVALID_CURRENT_PASSWORD`, `NEW_PASSWORD_MUST_DIFFER`, `PASSWORD_TOO_COMMON`, `401` e `429` são tratados explicitamente com mensagens sanitizadas, sem exibir mensagens arbitrárias do backend. Em `401`, os campos de senha são apagados antes de chamar `refreshSession()`, sem retry automático da alteração e sem redirecionamento automático. No sucesso, a sessão atual é preservada e a mensagem informa que as demais sessões foram encerradas. `/conta/seguranca` pode ser acessada por usuário autenticado mesmo com `phoneVerified=false`; o `PhoneVerificationGuard` não precisou ser modificado e recebeu teste para fixar esse comportamento.

ASVS 5.0.0 V6.2.2 e V6.2.3 estão tratados pelos commits `f8ea104` e `777732b`, preservando V6.2.4 e V6.2.5 como já tratados e sem declarar conformidade ASVS geral.

### Cookie de refresh

O cookie `soravi_refresh_token` usa `HttpOnly: true`, `SameSite: lax` e `Secure` somente quando `NODE_ENV === "production"`. Seu `Path` passou de `/` para `/api/v1/auth`, reduzindo o envio para outras rotas da API. As opções comuns de set e clear são centralizadas para evitar divergência; `expires` é informado somente na criação do cookie.

Percent-encoding inválido no cookie não gera `URIError`/500. Refresh com cookie malformado continua resultando em `UnauthorizedException`. Logout com cookie ausente ou malformado não tenta revogar sessão, mas ainda limpa o cookie.

As pendências pré-beta de sessão estão no [backlog](07-backlog.md#hardening-de-sessão-pré-beta).

### Regras recomendadas

* senhas armazenadas com Argon2id;
* refresh tokens armazenados como hash;
* tokens sensíveis não devem ser armazenados em texto puro;
* cookies seguem a política de `HttpOnly`, `SameSite` e `Secure` por ambiente descrita acima;
* logout deve revogar a sessão;
* usuário poderá revogar todas as sessões;
* login e refresh já possuem rate limiting via `ThrottlerGuard` (10 e 60 requisições / 15 minutos); recuperação de senha também já é limitada;
* mensagens não devem revelar se um e-mail existe ou não;
* tokens de recuperação deverão expirar e ser utilizados uma única vez.

O armazenamento de tokens sensíveis em `localStorage` não será adotado como estratégia principal.

---

## 14. Autorização

A autorização não deverá depender apenas do papel do usuário.

Cada operação deverá validar:

```text
autenticação
+ papel
+ propriedade do recurso
+ estado atual
+ regra específica da ação
```

Exemplo:

Um cliente autenticado não poderá editar uma solicitação pertencente a outro cliente.

Um profissional não poderá enviar proposta para uma solicitação encerrada.

Um usuário não poderá acessar uma conversa da qual não participa.

Um cliente somente poderá avaliar uma contratação concluída da qual seja parte.

---

## 15. Chat e WebSockets

WebSockets serão utilizados para comunicação em tempo real.

### Fluxo recomendado

1. Usuário abre uma conexão autenticada.
2. Backend valida a sessão.
3. Usuário envia uma mensagem.
4. Backend valida o acesso à conversa.
5. Mensagem é persistida no PostgreSQL.
6. Backend confirma o recebimento.
7. Evento é enviado aos participantes autorizados.
8. Notificação é criada quando necessário.

### Regras

* PostgreSQL será a fonte oficial das mensagens;
* WebSocket não substituirá a persistência;
* cliente não poderá definir livremente o remetente;
* acesso à conversa deverá ser validado em cada operação;
* Redis será utilizado para WebSockets apenas quando houver múltiplas instâncias ou necessidade comprovada;
* mensagens devem possuir identificador e data gerados pelo servidor.

---

## 16. Notificações

As notificações do MVP serão armazenadas no PostgreSQL.

Campos básicos:

* usuário destinatário;
* tipo;
* título;
* mensagem;
* recurso relacionado;
* data de criação;
* data de leitura.

A atualização poderá começar com:

* revalidação;
* polling controlado;
* consulta ao abrir o painel.

Notificações em tempo real poderão ser adicionadas posteriormente com WebSockets.

---

## 17. Upload e armazenamento de arquivos

Arquivos serão armazenados em serviço compatível com S3.

### Fluxo recomendado

1. Frontend solicita autorização.
2. Backend valida o usuário e o contexto.
3. Backend gera URL assinada.
4. Frontend envia o arquivo.
5. Backend registra os metadados.
6. Arquivo é validado ou processado quando necessário.

### Requisitos

* limite de tamanho;
* tipos de arquivo permitidos;
* validação do MIME type real;
* nome interno gerado pelo sistema;
* proibição de executáveis;
* URLs privadas ou assinadas;
* política de remoção;
* remoção de metadados sensíveis de imagens, quando aplicável;
* registro do proprietário do arquivo;
* possibilidade de bloquear arquivos em análise.

---

## 18. Segurança

A arquitetura deverá incluir:

* HTTPS obrigatório;
* hash seguro de senhas;
* autenticação e autorização;
* validação de todas as entradas;
* CORS restrito;
* rate limiting;
* headers de segurança;
* proteção contra SQL Injection;
* proteção contra XSS;
* proteção contra CSRF conforme a estratégia de autenticação;
* logs estruturados;
* auditoria administrativa;
* gerenciamento seguro de segredos;
* backups;
* testes de restauração;
* tratamento padronizado de erros.

Credenciais e segredos deverão ser armazenados exclusivamente em variáveis de ambiente ou serviços de gerenciamento de segredos.

Nenhuma credencial poderá ser colocada diretamente no código ou no repositório.

---

## 19. LGPD e privacidade

A arquitetura deverá permitir:

* consentimento e aceite de termos;
* versionamento de termos e políticas;
* correção de dados pessoais;
* exportação de dados;
* exclusão ou anonimização;
* política de retenção;
* controle de acesso administrativo;
* registro de ações sensíveis;
* minimização dos dados coletados;
* proteção de dados pessoais;
* resposta a incidentes.

Logs não deverão armazenar dados pessoais além do necessário.

Mensagens, documentos e informações sensíveis deverão possuir acesso restrito.

---

## 20. Observabilidade

A aplicação deverá possuir:

* logs estruturados;
* monitoramento de erros;
* identificador de requisição;
* métricas de desempenho;
* health checks;
* monitoramento de disponibilidade;
* alertas para falhas críticas.

### Health checks

```text
GET /health/live
GET /health/ready
```

### Campos recomendados nos logs

```text
timestamp
level
requestId
method
route
statusCode
duration
userId, quando permitido
errorCode
```

Não deverão ser registrados:

* senhas;
* tokens;
* códigos de recuperação;
* credenciais;
* documentos pessoais completos;
* informações sigilosas desnecessárias.

---

## 21. Ambientes

A Soravi terá inicialmente três ambientes:

### Desenvolvimento

Utilizado pelos desenvolvedores localmente.

### Homologação

Utilizado para:

* validação;
* testes integrados;
* revisão;
* demonstrações;
* aprovação antes da produção.

### Produção

Ambiente utilizado pelos usuários reais.

Cada ambiente deverá possuir:

* banco separado;
* credenciais separadas;
* variáveis próprias;
* armazenamento separado;
* monitoramento apropriado.

Dados de produção não deverão ser copiados para ambientes inferiores sem anonimização.

---

## 22. Deploy

### Frontend

Hospedado inicialmente na Vercel.

### Backend

Empacotado com Docker e hospedado em serviço gerenciado compatível.

### Banco de dados

PostgreSQL gerenciado com:

* backups automáticos;
* conexão segura;
* monitoramento;
* política de restauração.

### Arquivos

Armazenamento em nuvem compatível com S3.

### Redis

Serviço gerenciado somente quando sua utilização for necessária.

O frontend e o backend deverão possuir processos de deploy independentes.

---

## 23. Integração contínua

O pipeline deverá executar progressivamente:

* instalação de dependências;
* lint;
* verificação de tipos;
* testes unitários;
* testes de integração;
* build;
* validação de migrations;
* análise de segurança das dependências.

Deploy em produção deverá depender da aprovação e da estabilidade do pipeline.

---

## 24. Estratégia Git

Fluxo recomendado para a equipe inicial:

```text
main
feature/*
fix/*
docs/*
refactor/*
chore/*
```

### Regras

* `main` deverá permanecer implantável;
* branches deverão ter vida curta;
* cada branch deverá possuir objetivo claro;
* pull requests deverão ser pequenos;
* commits deverão ser objetivos;
* alterações importantes deverão atualizar a documentação.

A branch `develop` poderá ser adotada futuramente caso o processo da equipe passe a exigir uma etapa permanente de integração.

---

## 25. Testes

### Testes unitários

Prioridade para:

* regras de negócio;
* transições de estado;
* autenticação;
* autorização;
* aceite de proposta;
* conclusão de contrato;
* avaliação.

### Testes de integração

Prioridade para:

* API;
* PostgreSQL;
* Prisma;
* módulos integrados;
* autenticação e sessões.

A primeira infraestrutura de integração PostgreSQL real foi concluída no commit `020fd3b test(auth): adiciona testes reais de concorrencia`. Ela usa `apps/api/jest.integration.config.cjs`, separado da configuração unitária, e é executada pelo script `test:integration`.

A suíte aceita exclusivamente o banco local `soravi_integration_test`: protocolo PostgreSQL, host `localhost` ou `127.0.0.1`, porta `5432` e nome exato do database. A URL é validada antes da criação dos clientes Prisma e `current_database()` é conferido antes de qualquer fixture. Nenhuma URL ou credencial é registrada, nenhuma migration é executada automaticamente e o banco local normal `soravi` não recebe fixtures.

O teste de login versus bloqueio administrativo usa três clientes Prisma independentes, operações e locks reais. Quando o login vence, seu `user.update` mantém o lock, o bloqueio espera de fato, a sessão é criada e depois revogada pelo status final `BLOCKED`. Quando o bloqueio vence, o login pré-lê `ACTIVE`, espera no `user.update`, revalida `BLOCKED` após adquirir o lock e reverte: nenhuma `AuthSession` persiste e `lastLoginAt` permanece `null`. Nos dois casos, `pg_backend_pid()` identifica a transação perdedora e `pg_blocking_pids()` confirma a contenção antes da liberação da vencedora.

O commit `9443580 test(auth): cobre concorrencia entre login e reset de senha` adicionou a mesma comprovação real para login versus confirmação de password reset. Se o login vence o lock de `User`, o reset espera no PostgreSQL; o login cria a sessão e, após ser liberado, o reset troca o `passwordHash`, consome o `PasswordResetToken` e revoga a sessão recém-criada. Se o reset vence seu `SELECT ... FOR UPDATE`, o login pré-lê `ACTIVE` e o hash antigo, bloqueia no `user.update` e, depois do commit do reset, rejeita a credencial divergente com `InvalidCredentialsException`; nenhuma sessão nova persiste e `lastLoginAt` permanece `null` pelo rollback.

O commit `50b0277 test(auth): cobre limite de sessoes sob logins concorrentes` comprovou a regra de máximo de cinco sessões com cinco `AuthSession` ativas e dois logins simultâneos para o mesmo usuário. O login A mantém o lock real de `User`; o login B bloqueia no `user.update`, e a contenção é confirmada por `pg_backend_pid()` e `pg_blocking_pids()` antes da liberação de A. Depois do commit de A, B lê o estado atualizado e reaplica a regra. Ambos terminam com sucesso e o usuário permanece `ACTIVE`.

O resultado contém sete sessões no total, cinco ativas e duas revogadas. S1, S2 e S3 usam o mesmo `createdAt`; o desempate por `id ASC` revoga apenas S1 e S2, preservando S3, S4, S5 e as duas sessões novas. O teste considera ativa a sessão não revogada, ainda não expirada e dentro do lifetime absoluto de 90 dias.

A coordenação de teste usa Promises/barreiras e `setImmediate` somente para ceder o event loop no polling, sem `sleep`, `setTimeout` ou mocks de `$transaction`, `user.update` e `$queryRaw`; queries de `PasswordResetToken` e `AuthSession` também permanecem reais. Todos esses testes usam somente `soravi_integration_test`, sem dados do banco local normal `soravi` e sem migrations automáticas. A base será reutilizada em testes futuros de login versus troca de senha autenticada e outros fluxos críticos ainda pendentes.

### Testes E2E

Fluxos críticos:

1. Cadastro.
2. Login.
3. Criação de solicitação.
4. Envio de proposta.
5. Aceite da proposta.
6. Liberação do chat.
7. Conclusão do serviço.
8. Avaliação.

---

## 26. Regras de evolução

Antes de adicionar uma nova tecnologia, deverá ser respondido:

1. Qual problema concreto ela resolve?
2. Esse problema existe atualmente?
3. A solução atual é insuficiente?
4. Qual será o custo de operação?
5. Qual será o impacto na manutenção?
6. A equipe consegue suportá-la?
7. Existe uma alternativa mais simples?

Tecnologias não deverão ser adicionadas apenas por tendência ou possibilidade futura.

---

## 27. Decisões oficiais desta versão

Esta versão oficializa:

1. Uso de monólito modular no MVP.
2. Separação entre frontend Next.js e backend NestJS.
3. PostgreSQL como fonte principal de dados.
4. Redis somente quando houver necessidade concreta.
5. Inclusão de uma entidade própria de contratação.
6. Possibilidade de um usuário possuir perfil de cliente e profissional.
7. Chat liberado somente após o aceite da proposta no MVP.
8. Uso de access token e refresh token com rotação.
9. Armazenamento de arquivos fora do banco.
10. Controle explícito das transições de estado.
11. Organização progressiva do projeto como monorepo.
12. Regras de negócio e autorização concentradas no backend.
13. Adoção de observabilidade, segurança e LGPD desde o início.
14. Microsserviços somente após necessidade comprovada.

---

## 28. Diretriz final

A arquitetura da Soravi deverá permanecer simples, segura, modular e preparada para evolução.

O objetivo não é antecipar toda a infraestrutura de uma empresa de grande escala.

O objetivo é construir uma base profissional que permita validar o MVP, aprender com os usuários e evoluir com segurança, sem comprometer a velocidade de desenvolvimento.
