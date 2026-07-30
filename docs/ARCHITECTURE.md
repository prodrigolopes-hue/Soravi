# Arquitetura Técnica

A Soravi começa como um monólito modular.

```text
Navegador -> Next.js -> NestJS -> PostgreSQL / Redis
```

## Decisões
- Monorepo com npm workspaces
- Next.js e TypeScript
- NestJS e TypeScript
- PostgreSQL
- Prisma ORM
- Redis para cache e chat
