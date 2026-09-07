# 06 - Roadmap

# Objetivo

Definir a evolução da Soravi em fases, garantindo entregas incrementais
e foco no MVP.

------------------------------------------------------------------------

# Fase 1 --- Fundação (MVP)

Objetivos: - Cadastro e login - Perfis de cliente e profissional -
Categorias - Solicitações de serviço - Propostas - Chat básico -
Avaliações - Painel administrativo inicial

Meta: validar o modelo de negócio.

------------------------------------------------------------------------

# Épico --- Crescimento orgânico e descoberta por problemas

Objetivo: ampliar a descoberta da Soravi por meio de conteúdo, páginas
relevantes e jornadas orientadas por problema.

Subitens:

-   SEO técnico base;
-   arquitetura de slugs;
-   taxonomia geográfica;
-   páginas de categoria;
-   Hub de Problemas;
-   páginas locais;
-   blog técnico;
-   perfis públicos indexáveis;
-   sitemap escalável;
-   dados estruturados;
-   redirecionamentos;
-   painel editorial;
-   Search Console e métricas.

Essa iniciativa complementa o MVP e deverá ser executada com critérios
editoriais e de qualidade.

------------------------------------------------------------------------

# Fase 2 --- Crescimento

Adicionar: - Busca avançada - Favoritos - Notificações em tempo real -
Perfil público do profissional - Histórico de serviços - Melhorias de
desempenho

Meta: aumentar retenção e recorrência.

------------------------------------------------------------------------

# Fase 3 --- Monetização

Implementar: - Planos para profissionais - Destaque de anúncios -
Relatórios e métricas - Cupons promocionais

Meta: gerar receita recorrente.

------------------------------------------------------------------------

# Fase 4 --- Escala

Adicionar: - Aplicativo mobile - Geolocalização - IA para
recomendações - Integrações com pagamentos - Agenda e calendário

Meta: expansão nacional.

------------------------------------------------------------------------

# Indicadores

-   Usuários ativos
-   Serviços publicados
-   Propostas enviadas
-   Contratações concluídas
-   Avaliação média
-   Receita mensal

------------------------------------------------------------------------

# Prioridades

1.  Entregar valor rapidamente.
2.  Ouvir os usuários.
3.  Evoluir com base em dados.
4.  Evitar funcionalidades desnecessárias no MVP.

------------------------------------------------------------------------

# Próximo Marco

Concluir o MVP e disponibilizar uma versão beta para os primeiros
usuários, coletando feedback antes do lançamento oficial.

Antes do beta, revisar o risco residual conhecido e monitorado do hardening de
dependências de 2026-09-02. O baseline de `npm audit --omit=dev` foi reduzido de
14 para 6 vulnerabilidades por atualizações compatíveis, sem
`npm audit fix --force`; as ocorrências restantes estão concentradas em
`deepmerge-ts` 7.1.5,
`mysql2` 3.15.3 e `postcss` 8.4.31. A revisão deverá ser repetida sempre que
houver atualização compatível upstream, sem overrides internos do Prisma ou
Next.js apenas para zerar a auditoria sem validação de compatibilidade.

Em 2026-09-03, foi concluída a primeira etapa do hardening HTTP/CSP do frontend:
`X-Powered-By` foi removido; foram adicionados `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS somente em
produção; e a CSP entrou em `Content-Security-Policy-Report-Only`, ainda sem
enforcement. A política explicita API, WebSocket equivalente, ViaCEP, Google
Analytics e a origin privada R2 das fotos. `img-src` aceita apenas `'self'`,
`data:`, `blob:` e
`https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com`,
sem wildcard ou `https:` genérico. Testes locais confirmaram fotos, navegação e
chat sem novas violações funcionais.

Em 2026-09-04, o commit técnico
`40f766f feat(web): adiciona nonce dinamico ao CSP` concluiu o hardening de
`script-src`. Um nonce criptograficamente imprevisível é gerado por requisição
no middleware, enviado nos request headers internos ao Next.js e aplicado aos
scripts renderizados; os dois componentes `next/script` do Google Analytics
recebem o mesmo nonce. `script-src` não usa mais `'unsafe-inline'` e usa nonce
com `'strict-dynamic'`. A CSP de production não permite `'unsafe-eval'`. Em um
teste local posterior, porém, o modo Report-Only detectou uma tentativa de uso
pela geração dinâmica de código/JIT do Zod 4.4.3. O commit técnico
`c755262 feat(web): configura Zod sem JIT para CSP` criou
`apps/web/lib/zod.ts`, configurou `z.config({ jitless: true })` e centralizou os
imports diretos de Zod, sem alterar schemas, mensagens ou regras de negócio e
sem adicionar `'unsafe-eval'` à política. TypeScript, ESLint direcionado, build
e `git diff --check` passaram; a violação anteriormente observada deixou de
aparecer em `/solicitacoes/nova` no teste local em production. A CSP continua
exclusivamente Report-Only, sem CSP
bloqueante ativa no navegador; API, WebSocket, ViaCEP, Google Analytics e a
origin específica do R2 permanecem explicitamente permitidos, sem wildcard ou
`https:` genérico, e HSTS continua condicionado a production.

TypeScript, ESLint dos arquivos alterados, build do frontend e
`git diff --check` passaram. Também foram confirmados nonce no header CSP,
variação entre requisições, nonce no HTML, resposta do navegador somente
Report-Only e HSTS no teste local em production. O nonce por requisição tornou
as páginas server-rendered dinamicamente; esse trade-off de cache/performance
será monitorado. Não se afirma deploy em produção nem CSP enforcement ativo.

O commit técnico `83b25bf feat(web): restringe estilos inline no CSP` trocou
`style-src 'self' 'unsafe-inline'` por `style-src 'self'`,
`style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`, sem alterar
`script-src` ou nonce. O diagnóstico encontrou zero tags `<style>` no HTML
inicial e no DOM observado, mas atributos `style=""` são gerados em runtime,
inclusive por elementos internos do Next.js/Next Image. Portanto,
`'unsafe-inline'` permanece temporariamente restrito a atributos, sem wildcard
ou `https:` genérico. Continuam pendentes sua remoção futura, a avaliação de
CSP bloqueante, sessões/tokens, cookies/refresh, rate limits e OWASP ASVS.

## Hardening de sessão concluído

Os commits `e4210b9` (cookie de refresh), `e3000fd` (lifetime absoluto de 90 × 24 horas), `14734d3` (rate limit de login/refresh), `eecb5d6` (máximo de 5 sessões simultâneas), `e70392e` (bloqueio de login com credencial desatualizada), `96abdd6` (serialização de refresh entre abas), `fa63449` (histórico de refresh tokens) e `0e2b376` (detecção de replay de refresh token) estão concluídos, sem afirmar deploy em produção. A [política implementada](ARCHITECTURE.md#13-autenticação-e-sessões) centraliza os detalhes e o [changelog](../CHANGELOG.md) registra as validações. As revisões de sessão ainda pendentes referem-se aos controles adicionais do [backlog pré-beta](07-backlog.md#hardening-de-sessão-pré-beta); os demais hardenings registrados permanecem pendentes.
