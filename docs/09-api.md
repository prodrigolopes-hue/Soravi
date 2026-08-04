# 09 - API

# Objetivo

Definir o padrão oficial das APIs da Soravi.

------------------------------------------------------------------------

# Padrões

-   REST API
-   JSON
-   UTF-8
-   Versionamento: /api/v1

Autenticação: - JWT Bearer Token

------------------------------------------------------------------------

# Auth

POST /api/v1/auth/register - Criar conta

POST /api/v1/auth/login - Autenticar usuário

POST /api/v1/auth/forgot-password - Solicitar recuperação de senha

POST /api/v1/auth/reset-password - Redefinir senha

------------------------------------------------------------------------

# Usuários

GET /api/v1/users/me - Dados do usuário autenticado

PUT /api/v1/users/me - Atualizar perfil

DELETE /api/v1/users/me - Encerrar conta

------------------------------------------------------------------------

# Solicitações

GET /api/v1/requests - Listar solicitações

POST /api/v1/requests - Criar solicitação

GET /api/v1/requests/{id} - Detalhes

PUT /api/v1/requests/{id} - Atualizar

DELETE /api/v1/requests/{id} - Excluir

------------------------------------------------------------------------

# Propostas

POST /api/v1/proposals GET /api/v1/proposals/{id} PUT
/api/v1/proposals/{id} DELETE /api/v1/proposals/{id}

------------------------------------------------------------------------

# Chat

GET /api/v1/chats

GET /api/v1/chats/{id}/messages

POST /api/v1/chats/{id}/messages

------------------------------------------------------------------------

# Avaliações

POST /api/v1/reviews

GET /api/v1/professionals/{id}/reviews

------------------------------------------------------------------------

# Administração

GET /api/v1/admin/dashboard

GET /api/v1/admin/users

PUT /api/v1/admin/users/{id}/block

------------------------------------------------------------------------

# Códigos HTTP

200 OK

201 Created

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

500 Internal Server Error

------------------------------------------------------------------------

# Convenções

-   Respostas padronizadas.
-   Mensagens de erro claras.
-   Validação de entrada em todos os endpoints.
-   Documentação via OpenAPI/Swagger.

## Autenticação

### POST `/api/v1/auth/register`

Cria um usuário cliente ou profissional.

Papéis públicos permitidos:

- `CUSTOMER`;
- `PROFESSIONAL`.

### POST `/api/v1/auth/login`

Autentica o usuário e cria uma sessão.

Resposta:

- usuário seguro;
- access token;
- refresh token;
- validade do access token em segundos.

### POST `/api/v1/auth/refresh`

Renova os tokens e rotaciona o refresh token.

Regras:

- o refresh token antigo deixa de funcionar;
- a sessão deve estar ativa;
- a sessão não pode estar expirada;
- a conta deve estar disponível.

### POST `/api/v1/auth/logout`

Revoga a sessão associada ao refresh token.

Resposta:

- HTTP `204 No Content`.

## Usuários

### GET `/api/v1/users/me`

Retorna os dados seguros do usuário autenticado.

Requer:

```text
Authorization: Bearer <accessToken>