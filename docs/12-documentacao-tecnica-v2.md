# 12 - Documentação Técnica v2

## Objetivo

Consolidar as diretrizes técnicas da Soravi para que qualquer
desenvolvedor consiga compreender, evoluir e manter o sistema.

------------------------------------------------------------------------

# Arquitetura (C4)

## Contexto

Usuários (Clientes, Profissionais e Administradores) │ ▼ Frontend
(Next.js) │ REST API │ Backend (NestJS) │ ├── PostgreSQL ├── Redis └──
Armazenamento de Arquivos

------------------------------------------------------------------------

# Fluxo Principal

1.  Cliente cria uma solicitação.
2.  Profissionais compatíveis recebem notificação.
3.  Profissionais enviam propostas.
4.  Cliente escolhe uma proposta.
5.  Chat é liberado.
6.  Serviço é concluído.
7.  Cliente avalia o profissional.

------------------------------------------------------------------------

# Estratégia de Segurança

-   HTTPS obrigatório
-   JWT para autenticação
-   Hash de senhas
-   Controle de acesso por perfil
-   Logs de auditoria
-   Rate Limiting
-   Proteção contra XSS, CSRF e SQL Injection
-   Validação de todas as entradas

------------------------------------------------------------------------

# Estratégia de Deploy

Ambientes:

-   Desenvolvimento
-   Homologação
-   Produção

Deploy:

Frontend: - Vercel

Backend: - Docker

Banco: - PostgreSQL gerenciado

------------------------------------------------------------------------

# Observabilidade

-   Logs estruturados
-   Monitoramento de erros
-   Métricas de desempenho
-   Health Check da API

------------------------------------------------------------------------

# Plano de Testes

Testes Unitários - Serviços - Regras de negócio

Testes de Integração - APIs - Banco de dados

Testes E2E - Cadastro - Login - Solicitações - Contratação

------------------------------------------------------------------------

# KPIs

-   Tempo médio para contratação
-   Taxa de conversão
-   Usuários ativos
-   Tempo de resposta da API
-   Disponibilidade do sistema

------------------------------------------------------------------------

# Roadmap Técnico

Fase 1 - MVP

Fase 2 - Otimização

Fase 3 - Escalabilidade

Fase 4 - Microsserviços (se necessário)

------------------------------------------------------------------------

# Diretriz Final

Toda evolução técnica deve preservar simplicidade, segurança, desempenho
e facilidade de manutenção. Evite adicionar complexidade antes que
exista uma necessidade real.
