# 09 - API

# Objetivo

Avaliações: `POST /api/v1/contracts/:contractId/review` aceita `rating` de 1 a 5 e `comment` opcional para o cliente proprietário após `COMPLETED`.

## Estado atual dos contratos

Solicitações: `POST /api/v1/service-requests` publica em `OPEN` com `publishedAt`; `GET /api/v1/service-requests/mine`, `GET /api/v1/service-requests/:serviceRequestId`, `POST /api/v1/service-requests/:serviceRequestId/cancel` e `POST /api/v1/service-requests/:serviceRequestId/photos` estão no fluxo atual. O frontend revisa antes do POST; não há endpoint de publicação separado.

Também estão implementados `POST /api/v1/contracts/:contractId/start`, `POST /api/v1/contracts/:contractId/complete`, `POST /api/v1/phone-verification/request`, `POST /api/v1/phone-verification/confirm` e os recursos de conversa para listagem, detalhe, mensagens e leitura. Endpoints de avaliações e favoritos são futuros e não devem ser tratados como entregues.

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

POST /api/v1/auth/password-reset/request - Solicitar recuperação de senha

POST /api/v1/auth/password-reset/confirm - Redefinir senha

PATCH /api/v1/users/me/password - Alterar a própria senha autenticada

Os dois endpoints são públicos. A solicitação recebe somente `email`, retorna
`202 Accepted` de forma neutra e possui rate limit, sem revelar existência ou
elegibilidade da conta. A entrega atual usa Resend por meio de
`PasswordResetDeliveryPort`.

A confirmação recebe somente `token` e `newPassword`, retorna `204 No Content`
e exige senha de 12 a 128 caracteres. Não há exigência obrigatória de letra,
número, maiúscula, minúscula ou símbolo; qualquer composição nesse intervalo é
permitida, exceto senhas comuns bloqueadas pelo backend. Uma confirmação válida
consome o token, invalida os demais tokens ativos, revoga todas as sessões e não
realiza auto-login.

A alteração autenticada de senha recebe somente `currentPassword` e
`newPassword`, retorna `204 No Content`, usa `userId` e `sessionId` do contexto
autenticado, exige senha atual correta, nova senha diferente e política central
12 a 128 com bloqueio de senhas comuns. A senha não é trimada, normalizada ou
truncada; o hash novo usa Argon2id; tokens pendentes de recuperação são
invalidados; as outras sessões são revogadas; a sessão atual permanece ativa.
O endpoint tem throttle de 3 tentativas por hora e não exige telefone
verificado.

## Registro de conta

### Requisição

POST `/api/v1/auth/register`

Rate limit: 5 requisições por 15 minutos, com `ThrottlerGuard` e contador Redis compartilhado entre instâncias (`d3f2183`).

Campos principais:

- `name`;
- `email`;
- `phone` (opcional);
- `password`;
- `initialRole` (`CUSTOMER` ou `PROFESSIONAL`);
- `acceptedTermsVersion`;
- `acceptedPrivacyPolicyVersion`;
- `categorySlugs?: string[]`.

Regras de categorias no registro:

- para `initialRole = PROFESSIONAL`, `categorySlugs` é obrigatório na prática;
- deve conter de 1 a 3 slugs;
- slugs devem ser únicos;
- slugs devem existir e estar ativos em `Category` (`isActive = true`);
- validação final é sempre do backend.

Compatibilidade:

- para `initialRole = CUSTOMER`, o cadastro continua sem obrigação de `categorySlugs`.

Transação de criação no registro profissional:

- criação de `User`, `ProfessionalProfile` e vínculos `ProfessionalCategory` ocorre na mesma transação;
- em caso de falha, não deve restar cadastro parcial.

------------------------------------------------------------------------

# Usuários

## Moderação administrativa de status

`PATCH /api/v1/users/admin/:userId/status`

Body permitido:

```json
{ "status": "ACTIVE" }
```

O valor também pode ser `BLOCKED`. Qualquer outro campo é rejeitado. O sucesso retorna `204 No Content`.

O endpoint exige `AccessTokenGuard`, `RolesGuard` e `Role.ADMIN`, valida `userId` como UUID, obtém `actorUserId` do contexto autenticado e não exige telefone verificado. Ele permite bloquear ou reativar somente CUSTOMER e PROFESSIONAL; rejeita self-target, qualquer alvo ADMIN, conta soft-deleted e estado atual `PENDING`, `SUSPENDED` ou `DEACTIVATED`.

Ao bloquear, status e revogação de todas as sessões ativas ocorrem na mesma transação, com `SELECT ... FOR UPDATE` sobre `User`. Repetir `BLOCKED` ainda revoga sessões residuais. Reativar não restaura sessões; repetir `ACTIVE` é no-op.

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

# Conversas

GET /api/v1/conversations

GET /api/v1/conversations/{conversationId}

GET /api/v1/conversations/{conversationId}/messages

POST /api/v1/conversations/{conversationId}/messages

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

GET /api/v1/category-suggestions/admin

PATCH /api/v1/category-suggestions/admin/{id}

Página administrativa relacionada:

- `/admin/categorias`.

## Categorias públicas

Endpoint público de categorias oficiais:

GET `/api/v1/categories`

Regras:

- retorna apenas categorias ativas;
- ordenação por `displayOrder` crescente e `name` crescente;
- fonte oficial para Home e cadastro profissional;
- PostgreSQL/API são a fonte de verdade das categorias.

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

## Sugestão pública de categoria

Fluxo público para receber sugestão de categoria durante o cadastro profissional quando o usuário ainda não está autenticado.

Escopo e separação:

- separado de `LaunchInterest`;
- separado do fluxo autenticado de `CategoryRequest`;
- não cria conta profissional;
- não cria categoria oficial automaticamente.

### Requisição

POST `/api/v1/category-suggestions`

Autenticação:

- não exige autenticação.

Payload:

```json
{
  "name": "Nome da pessoa",
  "email": "email@exemplo.com",
  "phone": "+55 11 99999-9999",
  "suggestedName": "Nome da categoria sugerida",
  "description": "Contexto opcional",
  "privacyNoticeAccepted": true
}
```

### Resposta

HTTP `200 OK`

```json
{
  "data": {
    "registered": true,
    "message": "Sua sugestão de categoria foi registrada para análise da Soravi."
  }
}
```

### Regras

- `privacyNoticeAccepted` deve ser `true`;
- status inicial é sempre `PENDING`;
- endpoint possui proteção básica contra abuso por rate limit (throttling);
- não cria `Category` automaticamente.

## Listagem administrativa de sugestões públicas de categoria

Endpoint administrativo para consulta de sugestões públicas de categoria.

### Requisição

GET `/api/v1/category-suggestions/admin`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Query:

- `page`: inteiro maior ou igual a `1` (padrão `1`);
- `pageSize`: inteiro entre `1` e `100` (padrão `20`).

### Regras de listagem

- inclui sugestões pendentes e já revisadas;
- ordenação por `createdAt` em ordem decrescente (mais recentes primeiro);
- retorna apenas campos operacionais necessários ao painel administrativo.

### Resposta

HTTP `200 OK`

```json
{
  "items": [
    {
      "id": "...",
      "suggestedName": "Encanador residencial",
      "description": "Atendimento em imóveis antigos.",
      "status": "PENDING",
      "createdAt": "2026-08-14T00:00:00.000Z",
      "name": "Nome da pessoa",
      "email": "email@exemplo.com",
      "phone": null,
      "reviewNotes": null,
      "reviewedAt": null
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
- `description`;
- `status` (`PENDING`, `APPROVED`, `REJECTED`);
- `createdAt`;
- `name`;
- `email`;
- `phone`;
- `reviewNotes`;
- `reviewedAt`.

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`.

## Moderação administrativa de sugestão pública de categoria

Endpoint administrativo para moderar uma sugestão pública de categoria.

### Requisição

PATCH `/api/v1/category-suggestions/admin/{id}`

Autenticação:

- Bearer access token obrigatório.

Autorização:

- `ADMIN` obrigatório.

Payload:

```json
{
  "status": "APPROVED",
  "reviewNotes": "Nota opcional"
}
```

`status` permitido no payload:

- `APPROVED`;
- `REJECTED`.

### Regras de transição

- somente sugestão com status `PENDING` pode ser moderada;
- transições válidas: `PENDING -> APPROVED` e `PENDING -> REJECTED`;
- sugestão já revisada não pode ser moderada novamente;
- aprovação não cria `Category` automaticamente;
- rejeição não apaga o registro;
- histórico de revisão é preservado (`reviewNotes`, `reviewedAt` e revisor administrativo).

### Resposta

HTTP `200 OK`

```json
{
  "id": "...",
  "suggestedName": "Encanador residencial",
  "description": "Atendimento em imóveis antigos.",
  "status": "APPROVED",
  "createdAt": "2026-08-14T00:00:00.000Z",
  "name": "Nome da pessoa",
  "email": "email@exemplo.com",
  "phone": null,
  "reviewNotes": "Nota opcional",
  "reviewedAt": "2026-08-14T01:00:00.000Z"
}
```

Respostas relevantes:

- `200 OK` - sucesso;
- `401 Unauthorized` - não autenticado ou token inválido;
- `403 Forbidden` - usuário autenticado sem role `ADMIN`;
- `404 Not Found` - sugestão não encontrada;
- `409 Conflict` - sugestão não está mais pendente.

## Frontend administrativo e segurança do fluxo

- o cadastro profissional possui bloco "Não encontrou sua categoria?" para envio da sugestão;
- envio da sugestão é independente da criação da conta;
- sugestão enviada não entra automaticamente na lista de categorias selecionáveis;
- mensagem orienta que o usuário pode continuar o cadastro normalmente;
- `/admin/categorias` possui terceira seção: "Sugestões públicas de categoria";
- `ADMIN` pode aprovar ou rejeitar sugestões pendentes;
- itens moderados permanecem no histórico sem novas ações;
- dados operacionais da sugestão pública só são exibidos no painel administrativo;
- o fluxo autenticado de `CategoryRequest` permanece separado do fluxo público.

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
