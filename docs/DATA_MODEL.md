# Modelo de Dados da Soravi

## 1. Objetivo

Este documento define o modelo de dados oficial do MVP da Soravi.

O modelo deve representar com segurança e consistência:

- usuários;
- perfis de cliente e profissional;
- categorias de serviço;
- solicitações;
- propostas;
- contratações;
- conversas;
- mensagens;
- avaliações;
- favoritos;
- notificações;
- verificações;
- moderação;
- sessões de autenticação;
- arquivos enviados pelos usuários.

O PostgreSQL será a fonte oficial dos dados permanentes da plataforma.

---

## 2. Princípios de modelagem

O modelo de dados deverá respeitar os seguintes princípios:

1. Um usuário poderá atuar como cliente e profissional.
2. A identidade do usuário será separada de seus perfis.
3. Regras críticas serão protegidas por validações e restrições no banco.
4. Estados de negócio não poderão ser alterados livremente.
5. Valores monetários serão armazenados em centavos.
6. Datas serão armazenadas em UTC.
7. Dados pessoais serão coletados somente quando necessários.
8. Exclusões sensíveis utilizarão exclusão lógica ou anonimização.
9. Arquivos não serão armazenados diretamente no PostgreSQL.
10. Redis não será utilizado como fonte permanente de dados.
11. Relações importantes possuirão índices e restrições únicas.
12. Alterações de schema serão realizadas por migrations versionadas.

---

## 3. Visão geral

```mermaid
erDiagram
    USER ||--o{ USER_ROLE : possui
    USER ||--o| CUSTOMER_PROFILE : possui
    USER ||--o| PROFESSIONAL_PROFILE : possui
    USER ||--o{ AUTH_SESSION : inicia
    USER ||--o{ NOTIFICATION : recebe
    USER ||--o{ FILE_ASSET : envia
    USER ||--o{ VERIFICATION : realiza

    PROFESSIONAL_PROFILE ||--o{ PROFESSIONAL_CATEGORY : atende
    CATEGORY ||--o{ PROFESSIONAL_CATEGORY : classifica

    CUSTOMER_PROFILE ||--o{ SERVICE_REQUEST : cria
    CATEGORY ||--o{ SERVICE_REQUEST : classifica
    SERVICE_REQUEST ||--o{ SERVICE_REQUEST_FILE : possui
    FILE_ASSET ||--o{ SERVICE_REQUEST_FILE : anexa

    SERVICE_REQUEST ||--o{ PROPOSAL : recebe
    PROFESSIONAL_PROFILE ||--o{ PROPOSAL : envia

    SERVICE_REQUEST ||--o| CONTRACT : gera
    PROPOSAL ||--o| CONTRACT : origina

    CONTRACT ||--o| CONVERSATION : libera
    CONVERSATION ||--o{ MESSAGE : possui
    USER ||--o{ MESSAGE : envia

    CONTRACT ||--o| REVIEW : recebe
    CUSTOMER_PROFILE ||--o{ REVIEW : realiza
    PROFESSIONAL_PROFILE ||--o{ REVIEW : recebe

    CUSTOMER_PROFILE ||--o{ FAVORITE : salva
    PROFESSIONAL_PROFILE ||--o{ FAVORITE : recebe

    USER ||--o{ REPORT : cria
    USER ||--o{ MODERATION_ACTION : executa