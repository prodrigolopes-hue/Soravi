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
