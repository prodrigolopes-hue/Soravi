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

POST /api/v1/launch-interests - Registrar interesse no lançamento

------------------------------------------------------------------------

## Lista de interesse no lançamento

Endpoint público para registrar o interesse no lançamento da Soravi.

### Requisição

POST `/api/v1/launch-interests`

```json
{
  "name": "Nome da pessoa",
  "email": "email@exemplo.com",
  "phone": "+55 11 99999-9999",
  "audienceType": "CUSTOMER",
  "city": "São Paulo",
  "state": "SP",
  "serviceInterest": "Preciso de serviços residenciais",
  "professionalCategoryInterest": null,
  "source": "HOME",
  "privacyNoticeAccepted": true,
  "marketingConsent": false
}
```

### Resposta

HTTP `200 OK`

```json
{
  "data": {
    "registered": true,
    "message": "Seu interesse no lançamento da Soravi foi registrado."
  }
}
```

### Regras

- Não cria conta de usuário.
- Não solicita senha, CPF, CNPJ ou documentos.
- `privacyNoticeAccepted` deve ser `true`.
- `email` deve ser normalizado antes de comparar duplicidade.
- `phone` é opcional.
- `state`, `serviceInterest`, `professionalCategoryInterest` e `source` são opcionais.
- A mesma base de e-mail atualiza o registro existente sem expor se o e-mail já existe.
- O retorno é uniforme para criação e atualização.

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

GET /api/v1/launch-interests - Listar pré-cadastros com paginação administrativa (requer `ADMIN` autenticado)

------------------------------------------------------------------------

## Lista de interesse no lançamento

A API pública para registro de interesse no lançamento será implementada em um incremento posterior.

Rota planejada:

- `POST /api/v1/launch-interests`

O registro não cria uma conta de usuário e não solicita senha, CPF, CNPJ ou documentos.

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