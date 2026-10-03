# 12 - Documentação Técnica v2

## Objetivo

## Estado operacional validado

### Avaliacoes bilaterais cegas

Implementadas e validadas localmente e em staging: cliente cria `Review` para profissional e profissional cria `CustomerReview` para cliente, uma por direcao em contrato `COMPLETED`. A janela e de sete dias a partir de `completedAt`; nota e inteira de 1 a 5, comentario e opcional e o prazo encerrado retorna `REVIEW_WINDOW_EXPIRED`.

A primeira avaliacao fica oculta com `publishedAt = null`; a segunda dentro da janela publica ambas. Em D+7, o `ReviewPublicationProcessor` publica a pendente e recalcula reputacao somente com avaliacoes publicadas. Ele roda no bootstrap e no intervalo `REVIEW_PUBLICATION_INTERVAL_MS`, gera lembretes idempotentes D+1/D+4/D+6 somente para pendentes e escolhe apenas o marco mais recente quando atrasado. D+7 nao gera lembrete. A Central de Notificacoes suporta os tres tipos `REVIEW_REMINDER_D1`, `REVIEW_REMINDER_D4` e `REVIEW_REMINDER_D6`. Migrations e validação E2E deste fluxo foram concluídas em staging na regressão final de 03/10/2026.

Cliente preenche, revisa e publica a solicitação; a criação gera `OPEN` e `publishedAt`, depois despacha oportunidades para profissionais aprovados, disponíveis e da categoria compatível. Bootstrap e processor periódico recuperam itens elegíveis sem depender de `editableUntil`; lock, idempotência e `skipDuplicates` são preservados.

### Verificação profissional

A verificação profissional, o perfil editável e a área Conta estão
**IMPLEMENTADOS, VALIDADOS LOCALMENTE E VALIDADOS EM STAGING**. O profissional com papel
`PROFESSIONAL` consulta e edita o próprio perfil em `/profissional/perfil`, por
`GET`/`PATCH /api/v1/users/me/professional-profile`: `displayName`,
`professionalTitle`, `serviceArea`, `bio`, de uma a três categorias e
`isAvailable`. A área autenticada inclui `/conta`, `/conta/telefone` e
`/conta/seguranca`; a alteração segura de telefone reutiliza o backend existente.
O cadastro profissional persiste `professionalTitle`, `serviceArea` e
`description` como `bio`.

O profissional submete o próprio perfil por
`POST /api/v1/users/me/professional-verification/submission`, nas transições
atômicas `NOT_STARTED -> PENDING` e `REJECTED -> PENDING`. A elegibilidade exige
perfil não excluído, `displayName`, telefone existente e verificado e categoria
ativa vinculada; no reenvio exige ainda `professionalTitle`, `serviceArea` e
`bio` com pelo menos 30 caracteres.

O administrador revisa somente perfis `PENDING` por
`PATCH /api/v1/users/admin/professionals/:userId/verification`, transicionando
para `APPROVED` ou `REJECTED`. A decisão é transacional, segura contra
concorrência e registra `reviewedAt`, `reviewedByUserId` e `reviewNotes`
opcional (após trim, até 1000 caracteres) como snapshot no
`ProfessionalProfile`. A mesma transação cria `ProfessionalVerificationReview`
append-only para cada decisão `PENDING -> APPROVED|REJECTED`. Em um reenvio, o
snapshot de revisão é limpo (`reviewedAt`, `reviewedByUserId` e `reviewNotes`
para `null`) e o histórico anterior permanece intacto.

Na UX, `REJECTED` mostra “Perfil não aprovado”; o fluxo exige editar, salvar e
só então usar “Reenviar para análise”, sem reenvio automático ao salvar.
`PENDING` mostra “Perfil em análise” e `APPROVED` mantém a indicação normal.
As notas de revisão podem ser vistas apenas pelo próprio profissional
autenticado, nunca em superfície pública. O frontend preserva o estado após
refetch/F5 e atualiza localmente a linha revisada. Documentos comprobatórios e
notificações da decisão continuam fora deste bloco.

Localmente, os testes de reenvio passaram (12/12), os builds da API e web
passaram e o E2E manual confirmou esse ciclo, inclusive a persistência de
`PENDING` após F5 e o retorno a `APPROVED` após aprovação administrativa.
Em staging, o E2E confirmou `NOT_STARTED -> PENDING -> APPROVED`,
`PENDING -> REJECTED` e `REJECTED -> editar -> salvar -> reenviar -> PENDING
-> APPROVED`; o motivo da revisão foi exibido somente ao profissional, o perfil
editado permaneceu salvo após F5 e a visão administrativa também terminou em
`APPROVED`. A conta `ADMIN` de teste e `/admin/profissionais` foram validadas
para Aprovar/Rejeitar. As migrations
`20260928000100_add_professional_profile_editable_fields` e
`20260929000100_create_professional_verification_reviews` foram aplicadas com
sucesso, e `prisma migrate status` confirmou `Database schema is up to date`
com 29 migrations. Isso não afirma deploy, go-live ou validação em produção.

Ao aceitar proposta, cria-se contrato `ACCEPTED` e conversa. Profissional inicia (`IN_PROGRESS`) no detalhe da oportunidade; cliente conclui (`COMPLETED`) no detalhe da solicitação. A conversa mantém chat e status. As avaliações bilaterais cegas descritas acima estão implementadas e validadas localmente e em staging.

### Regressão final de staging e próximo passo

Em 03/10/2026, a regressão final do MVP em staging foi aprovada: sanidade técnica (12 suítes focadas, 164 testes, builds de API e frontend e `git diff --check`), fluxos de CUSTOMER, PROFESSIONAL e ADMIN, restrições de papel e hardenings recentes. Incluem-se IDOR dos recursos privados, RBAC administrativo, concorrência de sugestões de categoria, destinos D1/D4/D6, robustez do processor de avaliações, healthchecks live/ready e PITR em banco separado.

Produção ainda não foi promovida, não recebeu deploy nesta etapa e não teve smoke test de produção. Antes do go-live, a sequência controlada é: revisar envs; confirmar `prisma migrate status` de produção; criar export lógico; aplicar migrations/deploy do backend; validar `/api/v1/health/ready`; mudar o healthcheck do serviço para essa rota; publicar o frontend; executar smoke test; e acompanhar Logs, Metrics, Events e notificações de falha.

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

## Rotas públicas planejadas de descoberta

`/servicos/[categorySlug]` é uma referência de rota planejada para a futura página de categoria; não está implementada. Ela deverá combinar descoberta direta de profissionais com entrada para criação de solicitação e recebimento de propostas.

O perfil público profissional também é futuro e sua rota definitiva ainda não foi decidida. Não há, por este registro, endpoint público, API de filtros ou regra de localização implementada.

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
