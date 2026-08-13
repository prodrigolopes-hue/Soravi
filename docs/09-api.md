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

GET /api/v1/launch-interests

GET /api/v1/users/admin/customers

GET /api/v1/users/admin/professionals

GET /api/v1/categories/admin

GET /api/v1/category-requests/admin

Lista interessados do lançamento para uso administrativo.

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a 1, padrão `1`;
- `pageSize`: inteiro entre `1` e `100`, padrão `20`.

Resposta:

```json
{
  "items": [
    {
      "id": "...",
      "name": "...",
      "email": "...",
      "phone": null,
      "audienceType": "CUSTOMER",
      "city": "...",
      "state": "SP",
      "serviceInterest": null,
      "professionalCategoryInterest": null,
      "source": "HOME",
      "privacyNoticeAcceptedAt": "...",
      "marketingConsentAt": null,
      "emailConfirmedAt": null,
      "unsubscribedAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Campos principais:

- `id`;
- `name`;
- `email`;
- `phone`;
- `audienceType`;
- `city`;
- `state`;
- `serviceInterest`;
- `professionalCategoryInterest`;
- `source`;
- `privacyNoticeAcceptedAt`;
- `marketingConsentAt`;
- `emailConfirmedAt`;
- `unsubscribedAt`;
- `createdAt`;
- `updatedAt`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

## Listagem administrativa de profissionais

Endpoint administrativo para consulta de profissionais cadastrados.

### Requisição

GET `/api/v1/users/admin/professionals`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a `1` (padrão `1`);
- `pageSize`: inteiro entre `1` e `100` (padrão `20`).

### Regras de listagem

- somente usuários com `Role.PROFESSIONAL`;
- somente usuários com `ProfessionalProfile` existente;
- apenas registros com `deletedAt = null` em `User` e `ProfessionalProfile`;
- ordenação por `createdAt` em ordem decrescente;
- resposta sem campos sensíveis.

### Resposta

HTTP `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "name": "...",
      "email": "...",
      "phone": null,
      "status": "ACTIVE",
      "emailVerified": true,
      "phoneVerified": false,
      "createdAt": "2026-08-12T00:00:00.000Z",
      "professionalProfile": {
        "id": "...",
        "displayName": "...",
        "verificationStatus": "PENDING",
        "isAvailable": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Campos retornados por item:

- `id`;
- `name`;
- `email`;
- `phone`;
- `status`;
- `emailVerified`;
- `phoneVerified`;
- `createdAt`;
- `professionalProfile.id`;
- `professionalProfile.displayName`;
- `professionalProfile.verificationStatus`;
- `professionalProfile.isAvailable`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

## Listagem administrativa de categorias oficiais

Endpoint administrativo para consulta de categorias oficiais cadastradas.

### Requisição

GET `/api/v1/categories/admin`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a `1` (padrão `1`);
- `pageSize`: inteiro entre `1` e `100` (padrão `20`).

### Regras de listagem

- inclui categorias ativas e inativas;
- não filtra por `isActive`;
- ordenação por `displayOrder` crescente e `name` crescente;
- resposta com campos administrativos necessários, sem relações desnecessárias.

### Resposta

HTTP `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "name": "Eletricista",
      "slug": "eletricista",
      "isActive": true,
      "displayOrder": 1,
      "createdAt": "2026-08-12T00:00:00.000Z",
      "updatedAt": "2026-08-12T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Campos retornados por item:

- `id`;
- `name`;
- `slug`;
- `isActive`;
- `displayOrder`;
- `createdAt`;
- `updatedAt`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

## Listagem administrativa de solicitações de categoria

Endpoint administrativo para consulta de solicitações de categoria enviadas por profissionais.

### Requisição

GET `/api/v1/category-requests/admin`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a `1` (padrão `1`);
- `pageSize`: inteiro entre `1` e `100` (padrão `20`).

### Regras de listagem

- inclui solicitações de todos os status;
- não aplica filtro por status neste incremento;
- ordenação por `createdAt` em ordem decrescente;
- resposta sem dados sensíveis de autenticação e sessão.

### Resposta

HTTP `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "suggestedName": "Eletricista residencial",
      "status": "PENDING",
      "reviewNotes": null,
      "createdAt": "2026-08-12T00:00:00.000Z",
      "reviewedAt": null,
      "professionalProfile": {
        "id": "...",
        "displayName": "João Silva",
        "user": {
          "id": "...",
          "name": "João Silva",
          "email": "joao@soravi.com.br"
        }
      },
      "resolvedCategory": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Campos retornados por item:

- `id`;
- `suggestedName`;
- `status`;
- `reviewNotes`;
- `createdAt`;
- `reviewedAt`;
- `professionalProfile.id`;
- `professionalProfile.displayName`;
- `professionalProfile.user.id`;
- `professionalProfile.user.name`;
- `professionalProfile.user.email`;
- `resolvedCategory.id`;
- `resolvedCategory.name`;
- `resolvedCategory.slug`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

## Listagem administrativa de clientes

Endpoint administrativo para consulta de clientes cadastrados.

### Requisição

GET `/api/v1/users/admin/customers`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a `1` (padrão `1`);
- `pageSize`: inteiro entre `1` e `100` (padrão `20`).

### Regras de listagem

- somente usuários com `Role.CUSTOMER`;
- somente usuários com `CustomerProfile`;
- apenas registros com `deletedAt = null`;
- ordenação por `createdAt` em ordem decrescente;
- resposta sem campos sensíveis (não retorna senha, hash de token, e-mail normalizado ou telefone normalizado).

### Resposta

HTTP `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "name": "...",
      "email": "...",
      "phone": null,
      "status": "ACTIVE",
      "emailVerified": true,
      "phoneVerified": false,
      "createdAt": "2026-08-12T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Campos retornados por item:

- `id`;
- `name`;
- `email`;
- `phone`;
- `status`;
- `emailVerified`;
- `phoneVerified`;
- `createdAt`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

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