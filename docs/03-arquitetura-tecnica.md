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
