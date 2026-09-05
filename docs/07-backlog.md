# 07 - Backlog do Produto

# Objetivo

Organizar todas as funcionalidades da Soravi em uma lista priorizada
para orientar o desenvolvimento.

------------------------------------------------------------------------

# ÉPICO 1 - Autenticação

## História 1

Como usuário, quero criar uma conta.

Tarefas: - Tela de cadastro - Validação dos campos - Criptografia da
senha - Envio para API

## História 2

Como usuário, quero fazer login.

Tarefas: - Tela de login - JWT - Recuperação de senha - Manter sessão

------------------------------------------------------------------------

# ÉPICO 2 - Perfil

-   Editar perfil
-   Foto
-   Endereço
-   Categorias
-   Área de atuação

------------------------------------------------------------------------

# ÉPICO 3 - Solicitações

- [x] Model e migration de `ServiceRequest`.
- [x] `POST /api/v1/service-requests` cria solicitação própria em `OPEN`.
- [x] `GET /api/v1/service-requests/mine` para listar solicitações próprias.
- [x] `GET /api/v1/service-requests/:serviceRequestId` para consultar detalhes próprios.
- [x] Frontend `/solicitacoes/nova`.
- [x] Frontend `/solicitacoes`.
- [x] Frontend `/solicitacoes/[serviceRequestId]`.
- [x] Persistência de `ServiceRequestFile` e backend de upload de fotos.
- [x] Frontend para seleção e upload opcional de fotos, validado ponta a ponta com Cloudflare R2 privado e PostgreSQL.
- [x] `editableUntil` com janela inicial de 10 minutos e bloqueio de edição direta após a janela.
- [x] `opportunitiesDispatchedAt` para controlar distribuição única.
- [x] Edição direta durante a janela inicial.
- [x] Cancelamento direto com preservação de histórico enquanto `OPEN` e não distribuída.
- [x] `ServiceOpportunity` e matching inicial por categoria para profissionais aprovados, disponíveis, não excluídos e vinculados à categoria.
- [x] Distribuição transacional/idempotente após a janela e processor periódico interno com intervalo padrão de 60 segundos e lote padrão de 50.
- [ ] Prever moderação futura de alterações pós-distribuição por `ServiceRequestEditRequest`.
- [ ] Tratar exclusão lógica apenas como fluxo excepcional; não realizar exclusão física no MVP.
- [ ] Remover fotos persistidas.
- [ ] Reordenar fotos persistidas.
- [ ] Matching geográfico e área de atendimento estruturada.
- [ ] Notificações de oportunidades.
- [ ] Frontend profissional para listar oportunidades.
- [ ] Proteção distribuída para processor em múltiplas instâncias.
- [ ] Cancelamento pós-distribuição.
- [x] Model e migration de `Proposal`, com vínculo direto a `ServiceRequest` e `ProfessionalProfile`.
- [ ] Criar proposta a partir de oportunidade elegível e transicionar a primeira solicitação de `OPEN` para `RECEIVING_PROPOSALS`.
- [ ] Listar, editar e retirar propostas.
- [ ] Contratação.
- [ ] Chat.
- [ ] Avaliações.

------------------------------------------------------------------------

# ÉPICO 4 - Propostas

-   Enviar proposta
-   Editar proposta
-   Cancelar proposta
-   Selecionar profissional

------------------------------------------------------------------------

# ÉPICO 5 - Chat

-   Criar conversa
-   Enviar mensagens
-   Marcar como lida
-   Notificações

------------------------------------------------------------------------

# ÉPICO 6 - Avaliações

-   Avaliar profissional
-   Exibir nota média
-   Histórico

------------------------------------------------------------------------

# ÉPICO 7 - Administração

-   Dashboard
-   Gerenciar usuários
-   Gerenciar categorias
-   Moderar conteúdo

### Concluído até agora

- [x] Primeira tela administrativa.
- [x] Listagem de interessados do lançamento.
- [x] Listagem administrativa de clientes (`/admin/clientes`) com paginação e leitura.
- [x] Listagem administrativa de profissionais (`/admin/profissionais`) com paginação e leitura.
- [x] Listagem administrativa de categorias oficiais (`/admin/categorias`) com paginação e leitura.
- [x] Listagem administrativa de solicitações de categoria (`/admin/categorias`) com paginação e leitura.
- [x] Proteção visual por `ADMIN`.
- [x] Paginação básica.
- [x] Responsividade mobile e desktop.

### Pendente

- [ ] Dashboard administrativo completo.
- [ ] Gerenciamento de usuários (edição, exclusão, suspensão, filtros, busca e exportação).
- [ ] Gerenciamento completo de profissionais.
- [ ] Gerenciamento de categorias (criação, edição, ativação/desativação e exclusão).
- [ ] Moderação.
- [ ] Filtros.
- [ ] Busca.
- [ ] Exportação.
- [ ] Edição/exclusão.

------------------------------------------------------------------------

# Prioridade Atual

Sprint 1

-   Landing Page
-   Cadastro
-   Login
-   Estrutura do banco
-   Autenticação
-   Pré-cadastro: modelagem `LaunchInterest` (Prisma)
-   [x] API pública de registro de interesse no lançamento

------------------------------------------------------------------------

# Segmentação de backlog por maturidade

## MVP

Itens de fundação inicial:

-   metadata base;
-   sitemap;
-   robots;
-   home indexável;
-   slugs preparados;
-   estrutura inicial de categorias;
-   possibilidade futura de perfil público;
-   localização compatível com expansão;
-   CTA orientado por problema.

## Pós-MVP

-   páginas de categoria;
-   páginas de problema iniciais;
-   melhorias de SEO técnico;
-   dados estruturados básicos.

## Pré-beta — importante

### SEO técnico, indexação e identidade digital da Soravi

Objetivo: ajudar mecanismos de busca a reconhecer `soravi.com.br` como a
plataforma brasileira Soravi de serviços e profissionais, sem atribuir a este
trabalho prioridade superior às funcionalidades críticas do MVP.

- [ ] Configurar Google Search Console, `sitemap.xml`, `robots.txt` e canonical.
- [ ] Revisar metadata, Open Graph e consistência da descrição institucional.
- [ ] Implementar JSON-LD `Organization` e `WebSite` com redes oficiais em `sameAs`.
- [ ] Solicitar a indexação das páginas públicas principais.
- [ ] Monitorar buscas por Soravi/Soravi Brasil e confusão com outras entidades chamadas Soravi.
- [x] Executar o hardening de dependências com atualizações compatíveis: baseline de `npm audit --omit=dev` reduzido de 14 para 6 vulnerabilidades em 2026-09-02, sem `npm audit fix --force`; no primeiro patch, a API passou em TypeScript, 62 suítes/678 testes e build; após as atualizações compatíveis do frontend, passaram TypeScript, ESLint e build; após o Prisma 7.10.0, foram validados Prisma Client generation e build da API.
- [x] Implementar em 2026-09-03 a primeira etapa do hardening HTTP/CSP do frontend: remover `X-Powered-By`; adicionar `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS somente em produção; adotar `Content-Security-Policy-Report-Only`, sem enforcement, permitindo explicitamente API, WebSocket, ViaCEP, Google Analytics e a origin privada R2 das fotos. `img-src` permanece restrito a `'self'`, `data:`, `blob:` e `https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com`, sem wildcard ou `https:` genérico. Fotos, navegação e chat foram validados localmente sem novas violações funcionais.
- [x] Remover `'unsafe-inline'` de `script-src` com nonce por requisição no commit técnico `40f766f feat(web): adiciona nonce dinamico ao CSP`, concluído em 2026-09-04. O nonce imprevisível é propagado internamente ao Next.js e aos scripts renderizados, incluindo os dois `next/script` do Google Analytics; `script-src` usa nonce e `'strict-dynamic'`. A CSP de production não permite `'unsafe-eval'` e continua exclusivamente Report-Only, sem enforcement. As páginas tornaram-se server-rendered dinamicamente, com trade-off de cache/performance a monitorar. TypeScript, ESLint direcionado, build, `git diff --check` e os testes locais de headers, HTML, variação do nonce, Report-Only e HSTS passaram; isso não representa deploy em produção.
- [x] Restringir estilos inline no commit técnico `83b25bf feat(web): restringe estilos inline no CSP`: substituir `style-src 'self' 'unsafe-inline'` por `style-src 'self'`, `style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`, sem alterar `script-src` ou nonce. O diagnóstico encontrou zero tags `<style>` no HTML inicial e DOM observado e atributos `style=""` em runtime, inclusive do Next.js/Next Image. A CSP segue somente Report-Only, sem wildcard ou `https:` genérico.
- [x] Configurar Zod sem JIT no commit técnico `c755262 feat(web): configura Zod sem JIT para CSP`: o Report-Only em production local detectou tentativa de `'unsafe-eval'` pelo JIT do Zod 4.4.3, embora a política já não o permitisse. `apps/web/lib/zod.ts` configura `z.config({ jitless: true })` e centraliza os imports diretos, sem alterar schemas, mensagens ou regras. TypeScript, ESLint direcionado, build e `git diff --check` passaram, e a violação anteriormente observada deixou de aparecer em `/solicitacoes/nova`; isso não representa deploy ou enforcement.
- [ ] Revisar antes do beta e sempre que houver atualização compatível upstream o risco residual conhecido e monitorado em `deepmerge-ts` 7.1.5 (`@prisma/config`), `mysql2` 3.15.3 (Prisma/tooling; a Soravi usa PostgreSQL) e `postcss` 8.4.31 (Next.js 15.5.25), sem overrides internos apenas para zerar o `npm audit` sem validação de compatibilidade.
- [ ] Remover futuramente o `'unsafe-inline'` temporário de `style-src-attr` sem quebrar os atributos `style=""` gerados em runtime.
- [ ] Avaliar futuramente a ativação de CSP bloqueante, somente após concluir e observar o hardening em Report-Only.
- [ ] Revisar XSS, proteção de sessão e token, cookies/refresh, sessões, rate limits e OWASP ASVS pré-beta.

## Crescimento

-   Hub de Problemas completo;
-   páginas locais por cidade e bairro;
-   conteúdo educativo e blog técnico;
-   perfis públicos indexáveis;
-   expansão geográfica e editorial.
-   realizar análise competitiva estruturada de plataformas de serviços, usando É Pra Ontem, GetNinjas e Triider apenas como referências de pesquisa futura.

## Infraestrutura editorial

-   painel editorial;
-   revisão editorial;
-   governança de slugs e redirecionamentos;
-   Search Console e métricas de conteúdo;
-   automação editorial controlada.

Não incluir no MVP:

-   geração de milhares de páginas;
-   bairros em escala nacional;
-   blog completo;
-   automação editorial;
-   SEO programático em massa;
-   painel editorial completo.

------------------------------------------------------------------------

# Critério de Conclusão

Cada tarefa somente será considerada concluída quando:

-   Código implementado;
-   Testes realizados;
-   Revisão concluída;
-   Commit efetuado;
-   Documentação atualizada.

## Autenticação e autorização

### Concluído

- [x] Cadastro de cliente.
- [x] Cadastro de profissional.
- [x] Login com e-mail e senha.
- [x] Hash de senha com Argon2id.
- [x] Emissão de access token JWT.
- [x] Emissão de refresh token.
- [x] Criação de sessão no PostgreSQL.
- [x] Rotação segura do refresh token.
- [x] Bloqueio de reutilização do refresh token antigo.
- [x] Logout com revogação de sessão.
- [x] Manutenção de sessão persistente com refresh seguro em cookie HttpOnly e access token em memória.
- [x] Rota protegida `GET /api/v1/users/me`.
- [x] Validação do access token.
- [x] Validação da sessão no PostgreSQL.
- [x] Autorização por papéis.
- [x] Decorator `@Roles`.
- [x] `RolesGuard`.
- [x] Testes automatizados de autenticação e autorização.
- [x] Integração da autenticação com o frontend.

### Administração de profissionais

### Concluído

- [x] Listagem administrativa read-only de profissionais.

### Pendente

- [ ] Edição de profissional.
- [ ] Suspensão/bloqueio de profissional.
- [ ] Moderação de profissional.
- [ ] Curadoria de profissional.

### Pendente

- [x] Fundação de recuperação de senha no backend, com request/confirm, tokens protegidos e revogação de sessões.
- [x] Adapter Resend como provider real de recuperação de senha, desacoplado por `PasswordResetDeliveryPort`.
- [x] Frontend `/recuperar-senha` integrado ao endpoint real, com resposta neutra e erros sanitizados.
- [x] Frontend `/redefinir-senha` seguro, com token no fragmento mantido somente em memória e sem auto-login.
- [x] Validação manual ponta a ponta pela interface, incluindo Resend, expiração, redefinição e novo login.
- [ ] Confirmação de e-mail.
- [ ] Encerramento de todas as sessões.
- [ ] Listagem de sessões ativas.

## Categorias de serviços

### Concluído

- [x] Modelo `Category`.
- [x] Modelo `CategoryRequest`.
- [x] Modelo `ProfessionalCategory`.
- [x] Enum `CategoryRequestStatus`.
- [x] Migration de categorias e solicitações.
- [x] Migration da relação `ProfessionalProfile` ↔ `Category`.
- [x] Relação da solicitação com o perfil profissional.
- [x] Relação da análise com administrador ou moderador.
- [x] Possibilidade de vincular solicitação a categoria existente.
- [x] Definição da lista oficial de 8 categorias do MVP.
- [x] Home consumindo categorias pela API oficial.
- [x] Cadastro profissional consumindo categorias pela API oficial.
- [x] Envio de `categorySlugs` no cadastro profissional.
- [x] Persistência de categorias no cadastro profissional (1 a 3, ativas, sem duplicatas).

### Próximos itens

- [x] Criar módulo de categorias.
- [x] Criar listagem pública de categorias ativas.
- [x] Criar carga inicial de categorias.
- [x] Criar solicitação de categoria pelo profissional.
- [x] Criar listagem administrativa de categorias.
- [x] Criar listagem administrativa de solicitações de categoria.
- [ ] Detectar categorias e solicitações semelhantes.
- [ ] Criar painel administrativo de análise.
- [ ] Aprovar solicitação.
- [ ] Rejeitar solicitação.
- [ ] Vincular solicitação a uma categoria existente.
- [ ] Criar categoria oficial.
- [ ] Editar categoria oficial.
- [ ] Ativar/desativar categoria oficial.
- [ ] Notificar profissional sobre o resultado.
- [x] Associar categorias ao perfil profissional.
- [x] Criar formulário público de sugestão de categoria no cadastro profissional (pré-cadastro).
- [x] Persistir sugestão pública de categoria em entidade dedicada (`PublicCategorySuggestion`).
- [x] Criar listagem administrativa de sugestões públicas de categoria.
- [x] Moderar sugestão pública com `APPROVED` ou `REJECTED`.
- [x] Aplicar proteção básica contra abuso no endpoint público de sugestão.
- [ ] Transformar sugestão pública aprovada em `Category` oficial.
- [ ] Mesclar sugestão pública aprovada com categoria oficial existente.
- [ ] Criar `slug` automaticamente a partir de sugestão pública aprovada.
- [ ] Implementar ações equivalentes de moderação para `CategoryRequest` (aprovação, rejeição e mesclagem), quando aplicável.
- [ ] Notificações de resultado de moderação para fluxos de categoria.

## Verificação e curadoria de profissionais

### Épico

ÉPICO - Verificação e Curadoria de Profissionais.

### Objetivo

Fornecer mecanismos progressivos de confiança e segurança para profissionais, preservando escalabilidade operacional e minimização de dados.

### Itens futuros

- [x] fundação de confirmação de telefone, frontend `/verificar-telefone` e enforcement explícito em ações sensíveis;
- [x] disponibilizar número oficial dedicado à Soravi, criar a WABA e registrar o número na WhatsApp Cloud API;
- [ ] retomar Business Verification na preparação pré-beta, quando houver estrutura jurídica adequada, sem antecipar a formalização empresarial nem usar documentos de terceiros ou dados artificiais;
- [ ] obter da Meta permissão para criar o template pretendido `codigo_verificacao_soravi` (`AUTHENTICATION`, `pt_BR`, `COPY_CODE`, expiração de 10 minutos); a criação foi recusada por falta de permissão da WABA;
- [ ] validar envio real de OTP, configurar e assinar o webhook e ativar o provider Meta em produção;
- [ ] verificação básica de identidade;
- [ ] solicitação de CPF/CNPJ somente quando necessária à verificação;
- [ ] registro do resultado da verificação sem armazenar documentos completos desnecessariamente;
- [ ] evidências profissionais;
- [ ] portfólio/fotos;
- [ ] questionário curto por categoria;
- [ ] checklist de curadoria;
- [ ] classificação operacional de risco;
- [ ] pendências;
- [ ] análise manual adicional;
- [ ] aprovação;
- [ ] não aprovação com possibilidade de reavaliação;
- [ ] suspensão preventiva;
- [ ] revisão administrativa de suspensão;
- [ ] histórico de análises;
- [ ] motivo das decisões;
- [ ] registro de ocorrências;
- [ ] reavaliação após primeiros serviços;
- [ ] painel administrativo de curadoria.

### Capacidade esperada

CAPACIDADE - Identidade verificada.

Critérios conceituais:

- refletir somente o que efetivamente foi verificado;
- não sugerir certificação técnica;
- registrar método/data da verificação;
- respeitar minimização de dados.

### Governança de risco

"A classificação de risco não deverá ser automatizada enquanto critérios, governança, revisão humana e impactos não forem definidos em decisão futura específica."

### Fora do escopo deste épico imediato

- antecedentes criminais automáticos;
- scoring automatizado;
- IA para aprovação;
- certificação técnica automática;
- verificações de alto custo;
- coleta documental massiva.

### Priorização

Este épico não altera a prioridade geral do MVP sem aprovação do fundador e permanece fora do MVP imediato.
