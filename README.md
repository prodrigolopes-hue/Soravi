# Soravi

Plataforma brasileira para conectar pessoas a profissionais e soluções de serviços.

## Status
MVP em desenvolvimento, com o fluxo principal validado em Staging: autenticação e sessão, solicitação com revisão antes da publicação, oportunidades, propostas, contratação, chat e notificações. Production permanece separada de Staging.

## Estrutura
- `apps/web`: Next.js
- `apps/api`: NestJS
- `docs`: documentação
- `infra`: infraestrutura local

## Executar
```bash
npm install
docker compose up -d
npm run dev
```
