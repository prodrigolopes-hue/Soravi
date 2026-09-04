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
chat sem novas violações funcionais. A próxima etapa removerá gradualmente o
`'unsafe-inline'` temporário de `script-src` e `style-src` com nonce/hash; o
`'unsafe-eval'` observado no Next.js/Fast Refresh local não será liberado em
produção. Somente depois será avaliada uma CSP bloqueante.
