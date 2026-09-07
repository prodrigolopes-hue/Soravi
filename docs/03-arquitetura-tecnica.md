# 03 - Arquitetura Técnica

# Objetivo

Definir a arquitetura oficial da Soravi para garantir escalabilidade,
organização e facilidade de manutenção.

------------------------------------------------------------------------

# Arquitetura Geral

A Soravi será desenvolvida inicialmente como um **monólito modular**.

Frontend, backend e banco de dados serão separados por responsabilidade,
mas evoluirão juntos.

------------------------------------------------------------------------

# Stack Oficial

## Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   React Hook Form
-   Zod
-   TanStack Query

## Backend

-   NestJS
-   TypeScript
-   Prisma ORM
-   PostgreSQL
-   Redis
-   JWT
-   WebSockets

------------------------------------------------------------------------

# Estrutura Inicial

``` text
apps/
  web/
  api/

docs/
prisma/
public/

components/
features/
lib/
hooks/
types/
```

------------------------------------------------------------------------

# Organização do Frontend

-   components: componentes reutilizáveis
-   features: funcionalidades do sistema
-   lib: utilidades
-   hooks: hooks customizados
-   types: tipos TypeScript

------------------------------------------------------------------------

# Organização do Backend

Cada módulo conterá:

-   Controller
-   Service
-   DTOs
-   Entities
-   Guards
-   Validators

Exemplos:

-   auth
-   users
-   requests
-   proposals
-   chat
-   notifications
-   admin

------------------------------------------------------------------------

# Banco de Dados

PostgreSQL será a fonte principal de dados.

Prisma será o ORM oficial.

Redis será utilizado para:

-   cache;
-   notificações;
-   filas;
-   presença online;
-   WebSockets.

------------------------------------------------------------------------

# Segurança

-   JWT para autenticação.
-   Hash de senhas com algoritmo seguro.
-   Validação de entradas.
-   Controle de permissões por perfil.
-   Variáveis de ambiente para segredos.
-   Em 2026-09-02, o hardening compatível reduziu o baseline de `npm audit --omit=dev` de 14 para 6 vulnerabilidades. Foram atualizados Next.js 15.5.25, `qs` 6.16.0, `sharp` 0.35.4, `fast-uri` 3.1.7, `nanoid` 3.3.18 e Prisma/`@prisma/client` 7.10.0; o Prisma removeu Hono e `@hono/node-server` da árvore vulnerável e atualizou `valibot` para 1.4.2.
-   O baseline residual é risco conhecido e monitorado: `deepmerge-ts` 7.1.5 em `@prisma/config`, `mysql2` 3.15.3 no Prisma/tooling apesar do uso de PostgreSQL pela Soravi e `postcss` 8.4.31 interno do Next.js 15.5.25. Não foram usados `npm audit fix --force` nem overrides internos sem validação de compatibilidade.
-   Em 2026-09-03, o frontend passou a remover `X-Powered-By` e a enviar `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`, com `Strict-Transport-Security` somente em produção.
-   Em 2026-09-04, o commit técnico `40f766f feat(web): adiciona nonce dinamico ao CSP` concluiu o hardening de `script-src`. A CSP permanece exclusivamente em `Content-Security-Policy-Report-Only`, sem CSP bloqueante ativa no navegador. Um nonce criptograficamente imprevisível é gerado por requisição no middleware, inserido nos request headers internos para o Next.js e aplicado aos scripts renderizados; os dois componentes `next/script` do Google Analytics recebem o mesmo nonce.
-   `script-src` não usa mais `'unsafe-inline'` e usa nonce com `'strict-dynamic'`. A CSP de production não permitia `'unsafe-eval'`; depois, o modo Report-Only detectou uma tentativa de uso pela geração dinâmica de código/JIT do Zod 4.4.3. O commit técnico `c755262 feat(web): configura Zod sem JIT para CSP` criou `apps/web/lib/zod.ts`, configurou `z.config({ jitless: true })` antes dos schemas e centralizou os imports diretos de Zod do frontend, sem alterar schemas, mensagens ou regras de negócio. A violação anteriormente observada deixou de ocorrer em `/solicitacoes/nova` no teste local em production, sem adicionar `'unsafe-eval'` à CSP.
-   API, WebSocket equivalente, ViaCEP, Google Analytics e a origin específica do R2 `https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com` continuam explicitamente permitidos, sem wildcard ou `https:` genérico. HSTS permanece condicionado a production. Foram validados TypeScript, ESLint direcionado, build do frontend, `git diff --check`, nonce no header CSP, nonce diferente entre requisições, nonce presente no HTML, ausência de `'unsafe-inline'` em `script-src`, CSP de production local sem permissão para `'unsafe-eval'`, resposta somente Report-Only e HSTS em production local.
-   O commit técnico `83b25bf feat(web): restringe estilos inline no CSP` substituiu `style-src 'self' 'unsafe-inline'` por `style-src 'self'`, `style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`, sem alterar `script-src` ou nonce. O diagnóstico encontrou zero tags `<style>` no HTML inicial e no DOM observado, mas há atributos `style=""` gerados em runtime, inclusive por elementos internos do Next.js/Next Image; assim, `'unsafe-inline'` de estilos permanece temporariamente restrito aos atributos.
-   A CSP continua exclusivamente Report-Only, sem enforcement, wildcard ou `https:` genérico. O nonce mantém as páginas server-rendered dinamicamente e seu impacto de cache/performance será monitorado. Isso não afirma deploy em produção. Permanecem pendentes `style-src-attr 'unsafe-inline'`, revisão de sessões/tokens, cookies/refresh, rate limits, OWASP ASVS e avaliação futura de CSP bloqueante.

------------------------------------------------------------------------

# Git

Fluxo recomendado:

-   main
-   develop
-   feature/\*

Commits pequenos e objetivos.

------------------------------------------------------------------------

# Objetivo da Arquitetura

Manter um código limpo, modular e preparado para crescimento sem
antecipar complexidade desnecessária.

------------------------------------------------------------------------

# Crescimento Orgânico e Descoberta por Problemas

A arquitetura futura da Soravi deverá suportar uma jornada de descoberta
orientada por problema, categoria, localização e conteúdo educativo.

Em fases posteriores, a plataforma deverá prever:

-   SSR, SSG e revalidação conforme o tipo de página;
-   metadata dinâmica, Open Graph e Twitter Cards;
-   sitemap automático e, futuramente, dividido por domínio de conteúdo;
-   robots.txt, canonical, breadcrumbs e dados estruturados;
-   redirecionamentos 301 e controle de slugs;
-   páginas de categoria, problema, localidade e profissional com
    publicação controlada por regras;
-   suporte a entidades futuras de geografia, conteúdo e SEO;
-   respostas HTTP corretas para páginas inexistentes ou sem publicação.

A geração futura de páginas não deverá depender de rotas criadas
manualmente para cada combinação de categoria, cidade, bairro ou problema.
A publicação deverá ser baseada em entidades e regras de publicação,
com validação editorial e controle de qualidade.

## SEO técnico e conteúdo futuro

A arquitetura deverá prever:

-   SSR, SSG e revalidação conforme o tipo de página;
-   metadata dinâmica, Open Graph e Twitter Cards;
-   sitemap automático e, no futuro, dividido por tipo de conteúdo;
-   robots.txt, canonical, breadcrumbs e dados estruturados;
-   redirecionamentos 301 e gestão de slugs;
-   imagens otimizadas, lazy loading fora da área inicial e atenção a
    Core Web Vitals;
-   links internos rastreáveis e respostas HTTP corretas para páginas
    inexistentes.

Os dados estruturados deverão ser usados apenas quando corresponderem ao
conteúdo real, como Organization, WebSite, BreadcrumbList, Article,
Review, Person, ProfilePage, LocalBusiness, ProfessionalService e
FAQPage quando houver FAQ visível e aplicável.

## Hardening de sessão concluído

Os commits `e4210b9` (cookie de refresh), `e3000fd` (lifetime absoluto de 90 × 24 horas), `14734d3` (rate limit de login/refresh), `eecb5d6` (máximo de 5 sessões simultâneas), `e70392e` (bloqueio de login com credencial desatualizada), `96abdd6` (serialização de refresh entre abas), `fa63449` (histórico de refresh tokens) e `0e2b376` (detecção de replay de refresh token) estão concluídos, sem afirmar deploy em produção. A [política implementada](ARCHITECTURE.md#13-autenticação-e-sessões) centraliza os detalhes e o [changelog](../CHANGELOG.md) registra as validações. As revisões de sessão ainda pendentes referem-se aos controles adicionais do [backlog pré-beta](07-backlog.md#hardening-de-sessão-pré-beta); os demais hardenings registrados permanecem pendentes.
