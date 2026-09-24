# 12 - Documentação Técnica v2

## Objetivo

## Estado operacional validado

### Avaliacoes bilaterais cegas

Implementadas e validadas localmente: cliente cria `Review` para profissional e profissional cria `CustomerReview` para cliente, uma por direcao em contrato `COMPLETED`. A janela e de sete dias a partir de `completedAt`; nota e inteira de 1 a 5, comentario e opcional e o prazo encerrado retorna `REVIEW_WINDOW_EXPIRED`.

A primeira avaliacao fica oculta com `publishedAt = null`; a segunda dentro da janela publica ambas. Em D+7, o `ReviewPublicationProcessor` publica a pendente e recalcula reputacao somente com avaliacoes publicadas. Ele roda no bootstrap e no intervalo `REVIEW_PUBLICATION_INTERVAL_MS`, gera lembretes idempotentes D+1/D+4/D+6 somente para pendentes e escolhe apenas o marco mais recente quando atrasado. D+7 nao gera lembrete. A Central de Notificacoes suporta os tres tipos `REVIEW_REMINDER_D1`, `REVIEW_REMINDER_D4` e `REVIEW_REMINDER_D6`. Staging ainda requer migrations e validacao E2E.

Cliente preenche, revisa e publica a solicitação; a criação gera `OPEN` e `publishedAt`, depois despacha oportunidades para profissionais aprovados, disponíveis e da categoria compatível. Bootstrap e processor periódico recuperam itens elegíveis sem depender de `editableUntil`; lock, idempotência e `skipDuplicates` são preservados.

Ao aceitar proposta, cria-se contrato `ACCEPTED` e conversa. Profissional inicia (`IN_PROGRESS`) no detalhe da oportunidade; cliente conclui (`COMPLETED`) no detalhe da solicitação. A conversa mantém chat e status. As avaliações bilaterais cegas descritas acima estão implementadas e validadas localmente.

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

## Pré-lançamento

A modelagem da lista de interesse no lançamento foi adicionada ao banco.

Inclui:

- identificação como cliente, profissional ou ambos;
- origem do interesse;
- normalização e prevenção de duplicidade de e-mail;
- telefone opcional;
- registro do aceite do aviso de privacidade;
- consentimento opcional de marketing;
- preparação para confirmação de e-mail e cancelamento de comunicações.

A rota pública agora foi implementada no backend através de `POST /api/v1/launch-interests`.

O endpoint registra interesse sem criar conta de usuário e sem solicitar senha, CPF, CNPJ ou documentos.

A implementação utiliza validação de entrada, normalização de e-mail e telefone, e operação segura de upsert por `emailNormalized`.

------------------------------------------------------------------------

# Diretriz Final

Toda evolução técnica deve preservar simplicidade, segurança, desempenho
e facilidade de manutenção. Evite adicionar complexidade antes que
exista uma necessidade real.
