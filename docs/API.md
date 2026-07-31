# API da Soravi

## 1. Objetivo

Este documento define os contratos, padrões e endpoints oficiais da API do MVP da Soravi.

A API deverá permitir:

- autenticação segura;
- gerenciamento de usuários e perfis;
- publicação de solicitações;
- envio e aceite de propostas;
- criação de contratações;
- comunicação entre cliente e profissional;
- avaliações;
- favoritos;
- notificações;
- verificação;
- moderação;
- administração básica.

As regras de negócio serão aplicadas pelo backend NestJS.

O frontend não será considerado uma camada confiável para decisões de autorização ou transições de estado.

---

## 2. Princípios

A API deverá respeitar:

1. Segurança por padrão.
2. Contratos previsíveis.
3. Validação de todas as entradas.
4. Mensagens de erro claras.
5. Regras de negócio concentradas no backend.
6. Autorização por papel, perfil, propriedade e estado.
7. Versionamento desde o início.
8. Operações críticas executadas em transações.
9. Paginação em listagens.
10. Compatibilidade com dispositivos móveis.
11. Ausência de exposição de dados sensíveis.
12. Documentação OpenAPI atualizada.
13. Evolução incremental.
14. Idempotência nas operações críticas quando aplicável.
15. PostgreSQL como fonte oficial dos dados permanentes.

---

## 3. Padrões gerais

### 3.1 Protocolo

```text
HTTPS
```

HTTPS será obrigatório fora do ambiente local.

### 3.2 Formato

```text
JSON
UTF-8
```

### 3.3 Estilo

```text
REST
```

WebSockets serão utilizados somente nos recursos que necessitam comunicação em tempo real.

### 3.4 Prefixo

```text
/api/v1
```

Exemplo:

```text
GET /api/v1/categories
```

### 3.5 Content-Type

Requisições JSON deverão enviar:

```http
Content-Type: application/json
```

### 3.6 Datas

Datas serão representadas em ISO 8601 e UTC.

Exemplo:

```text
2026-07-30T22:15:00.000Z
```

### 3.7 Identificadores

Entidades principais utilizarão UUID.

Exemplo:

```text
550e8400-e29b-41d4-a716-446655440000
```

### 3.8 Valores monetários

Valores monetários serão enviados como números inteiros em centavos.

Exemplo:

```json
{
  "amountInCents": 15000
}
```

O exemplo representa:

```text
R$ 150,00
```

---

## 4. Ambientes

A API deverá possuir URLs separadas para:

```text
desenvolvimento
homologação
produção
```

Exemplos conceituais:

```text
Desenvolvimento:
http://localhost:3001/api/v1

Homologação:
https://api-staging.soravi.com.br/api/v1

Produção:
https://api.soravi.com.br/api/v1
```

Os domínios definitivos serão configurados posteriormente.

---

## 5. Autenticação

A autenticação utilizará:

- access token JWT de curta duração;
- refresh token com rotação;
- sessão registrada no PostgreSQL;
- refresh token armazenado como hash;
- revogação de sessão;
- recuperação de senha com token temporário.

### 5.1 Access token

O access token será enviado no cabeçalho:

```http
Authorization: Bearer ACCESS_TOKEN
```

O frontend não deverá armazená-lo permanentemente em `localStorage`.

A estratégia inicial será mantê-lo em memória e renová-lo através do endpoint de refresh.

### 5.2 Refresh token

O refresh token será enviado em cookie com:

```text
HttpOnly
Secure
SameSite
```

O valor original do refresh token não será armazenado no banco.

### 5.3 Sessões

Cada dispositivo poderá possuir sua própria sessão.

O usuário poderá:

- encerrar a sessão atual;
- listar sessões;
- revogar outra sessão;
- revogar todas as sessões.

### 5.4 Proteção contra enumeração

Endpoints de recuperação e verificação não deverão revelar se um e-mail está cadastrado.

Exemplo de resposta:

```json
{
  "data": {
    "message": "Caso exista uma conta para o e-mail informado, enviaremos as próximas instruções."
  }
}
```

---

## 6. Autorização

A autorização deverá considerar:

```text
usuário autenticado
+ papel
+ perfil
+ propriedade do recurso
+ estado atual
+ regra específica da ação
```

Exemplos:

- um cliente não poderá editar a solicitação de outro cliente;
- um profissional não poderá editar a proposta de outro profissional;
- uma proposta não poderá ser aceita após ser retirada;
- uma contratação concluída não poderá ser iniciada novamente;
- um usuário não poderá acessar uma conversa da qual não participa;
- somente administradores autorizados poderão bloquear usuários.

A verificação de papel não será suficiente isoladamente.

---

## 7. Cabeçalhos

### 7.1 Cabeçalhos comuns

```http
Accept: application/json
Content-Type: application/json
Authorization: Bearer ACCESS_TOKEN
```

### 7.2 Identificador de requisição

O backend deverá aceitar ou gerar:

```http
X-Request-Id: identificador
```

O identificador será devolvido na resposta:

```http
X-Request-Id: identificador
```

### 7.3 Idempotência

Operações críticas poderão exigir:

```http
Idempotency-Key: identificador-unico
```

Uso inicial recomendado:

- aceite de proposta;
- início de contratação;
- conclusão de contratação;
- cancelamento;
- finalização de upload.

O mesmo identificador não poderá produzir operações duplicadas.

---

## 8. Estrutura das respostas

## 8.1 Sucesso com recurso único

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Exemplo"
  }
}
```

## 8.2 Sucesso com lista

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Exemplo"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

## 8.3 Sucesso sem conteúdo

Endpoints de remoção ou ações sem corpo poderão retornar:

```text
204 No Content
```

---

## 9. Estrutura de erros

Todos os erros conhecidos deverão possuir estrutura padronizada.

```json
{
  "error": {
    "statusCode": 400,
    "code": "VALIDATION_ERROR",
    "message": "Os dados enviados são inválidos.",
    "details": [
      {
        "field": "email",
        "message": "Informe um e-mail válido."
      }
    ],
    "requestId": "identificador-da-requisicao",
    "timestamp": "2026-07-30T22:15:00.000Z"
  }
}
```

### Regras

A API não deverá expor:

- stack traces;
- mensagens internas do Prisma;
- consultas SQL;
- nomes de servidores;
- caminhos internos;
- segredos;
- tokens;
- credenciais;
- detalhes desnecessários da infraestrutura.

---

## 10. Códigos de erro

Códigos de erro serão estáveis e escritos em inglês.

Exemplos:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
ACCESS_TOKEN_EXPIRED
INVALID_REFRESH_TOKEN
SESSION_REVOKED
FORBIDDEN
RESOURCE_NOT_FOUND
EMAIL_ALREADY_IN_USE
PHONE_ALREADY_IN_USE
INVALID_STATE_TRANSITION
PROPOSAL_ALREADY_EXISTS
PROPOSAL_NOT_ACTIVE
CONTRACT_ALREADY_EXISTS
CONVERSATION_ACCESS_DENIED
REVIEW_ALREADY_EXISTS
FILE_NOT_READY
RATE_LIMIT_EXCEEDED
INTERNAL_ERROR
```

A mensagem apresentada ao usuário poderá ser traduzida pelo frontend.

---

## 11. Códigos HTTP

### Sucesso

```text
200 OK
201 Created
202 Accepted
204 No Content
```

### Erros do cliente

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
```

### Erros do servidor

```text
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
```

### Regras

- `400` para formato ou parâmetros inválidos;
- `401` quando autenticação estiver ausente ou inválida;
- `403` quando o usuário estiver autenticado, mas sem permissão;
- `404` quando o recurso não existir ou não puder ser revelado;
- `409` para conflito de estado ou unicidade;
- `422` para entrada válida sintaticamente, mas inválida para o domínio;
- `429` para excesso de requisições.

---

## 12. Paginação

Listagens comuns utilizarão:

```text
page
limit
```

Exemplo:

```text
GET /api/v1/categories?page=1&limit=20
```

### Valores padrão

```text
page = 1
limit = 20
```

### Limite máximo inicial

```text
limit = 100
```

Valores maiores serão limitados ou rejeitados.

### Mensagens

Listagens de mensagens utilizarão paginação baseada em cursor.

Exemplo:

```text
GET /api/v1/conversations/{id}/messages?before={messageId}&limit=30
```

Isso reduz inconsistências em conversas que recebem novas mensagens continuamente.

---

## 13. Ordenação e filtros

A API aceitará somente campos explicitamente permitidos.

Exemplo:

```text
GET /api/v1/professionals?categoryId=...&state=SP&city=Campinas&sort=rating_desc
```

Parâmetros não reconhecidos poderão ser rejeitados.

O cliente não poderá enviar nomes arbitrários de colunas do banco.

---

# 14. Autenticação

## 14.1 Cadastro

```text
POST /api/v1/auth/register
```

### Público

Sim.

### Entrada

```json
{
  "name": "Maria Silva",
  "email": "maria@example.com",
  "phone": "+5511999999999",
  "password": "senha-segura",
  "initialRole": "CUSTOMER",
  "acceptedTermsVersion": "1.0",
  "acceptedPrivacyPolicyVersion": "1.0"
}
```

### Regras

- nome obrigatório;
- e-mail válido e único;
- telefone validado quando informado;
- senha conforme política de segurança;
- papel inicial permitido;
- aceite dos termos e política obrigatório;
- criação de usuário e perfil inicial em transação;
- senha armazenada com hash seguro;
- resposta não deverá incluir `passwordHash`.

### Resposta

```text
201 Created
```

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Maria Silva",
      "email": "maria@example.com",
      "roles": ["CUSTOMER"],
      "emailVerified": false
    },
    "accessToken": "token"
  }
}
```

---

## 14.2 Login

```text
POST /api/v1/auth/login
```

### Público

Sim.

### Entrada

```json
{
  "email": "maria@example.com",
  "password": "senha-segura"
}
```

### Resposta

```text
200 OK
```

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "name": "Maria Silva",
      "email": "maria@example.com",
      "roles": ["CUSTOMER"]
    },
    "accessToken": "token"
  }
}
```

O refresh token será enviado por cookie seguro.

### Regras

- aplicar rate limiting;
- usar mensagem genérica para credenciais inválidas;
- registrar sessão;
- atualizar `lastLoginAt`;
- contas bloqueadas ou desativadas não poderão entrar;
- falhas não deverão revelar se o e-mail existe.

---

## 14.3 Renovar sessão

```text
POST /api/v1/auth/refresh
```

### Autenticação

Refresh token em cookie.

### Entrada

Sem corpo obrigatório.

### Resposta

```json
{
  "data": {
    "accessToken": "novo-token"
  }
}
```

### Regras

- validar sessão;
- validar expiração;
- validar hash;
- rotacionar refresh token;
- revogar sessão em caso de reutilização suspeita.

---

## 14.4 Logout

```text
POST /api/v1/auth/logout
```

### Autenticação

Sessão atual.

### Resposta

```text
204 No Content
```

### Regras

- revogar a sessão;
- remover o cookie;
- operação idempotente.

---

## 14.5 Logout de todas as sessões

```text
POST /api/v1/auth/logout-all
```

### Autenticação

Obrigatória.

### Resposta

```text
204 No Content
```

---

## 14.6 Solicitar recuperação de senha

```text
POST /api/v1/auth/forgot-password
```

### Público

Sim.

### Entrada

```json
{
  "email": "maria@example.com"
}
```

### Resposta

```text
202 Accepted
```

### Regras

- resposta genérica;
- token temporário;
- token armazenado como hash;
- rate limiting;
- envio assíncrono de e-mail;
- invalidar tokens anteriores quando necessário.

---

## 14.7 Redefinir senha

```text
POST /api/v1/auth/reset-password
```

### Público

Sim, com token.

### Entrada

```json
{
  "token": "token-de-recuperacao",
  "newPassword": "nova-senha-segura"
}
```

### Resposta

```text
204 No Content
```

### Regras

- token válido;
- token não expirado;
- token de uso único;
- revogação de sessões anteriores conforme política;
- nova senha armazenada com hash.

---

## 14.8 Verificar e-mail

```text
POST /api/v1/auth/verify-email
```

### Entrada

```json
{
  "token": "token-de-verificacao"
}
```

### Resposta

```text
204 No Content
```

---

## 14.9 Reenviar verificação de e-mail

```text
POST /api/v1/auth/resend-email-verification
```

### Autenticação

Obrigatória.

### Resposta

```text
202 Accepted
```

### Regras

- aplicar limite de frequência;
- não emitir novos tokens indefinidamente;
- invalidar token anterior quando necessário.

---

## 14.10 Listar sessões

```text
GET /api/v1/auth/sessions
```

### Autenticação

Obrigatória.

### Resposta

```json
{
  "data": [
    {
      "id": "uuid",
      "userAgent": "Navegador",
      "ipAddressMasked": "192.168.xxx.xxx",
      "createdAt": "2026-07-30T22:15:00.000Z",
      "lastUsedAt": "2026-07-30T22:20:00.000Z",
      "current": true
    }
  ]
}
```

---

## 14.11 Revogar uma sessão

```text
DELETE /api/v1/auth/sessions/{sessionId}
```

### Autenticação

Obrigatória.

### Resposta

```text
204 No Content
```

### Regra

O usuário somente poderá revogar suas próprias sessões.

---

# 15. Usuários

## 15.1 Obter usuário autenticado

```text
GET /api/v1/users/me
```

### Resposta

```json
{
  "data": {
    "id": "uuid",
    "name": "Maria Silva",
    "email": "maria@example.com",
    "phone": "+5511999999999",
    "avatarUrl": null,
    "roles": ["CUSTOMER"],
    "status": "ACTIVE",
    "emailVerified": true,
    "phoneVerified": false,
    "customerProfile": {
      "id": "uuid"
    },
    "professionalProfile": null,
    "createdAt": "2026-07-30T22:15:00.000Z"
  }
}
```

---

## 15.2 Atualizar usuário autenticado

```text
PATCH /api/v1/users/me
```

### Entrada

```json
{
  "name": "Maria Souza",
  "phone": "+5511988888888",
  "avatarFileId": "uuid"
}
```

### Regras

- somente campos permitidos;
- e-mail não será alterado silenciosamente;
- troca de e-mail exigirá fluxo próprio;
- avatar deverá pertencer ao usuário;
- telefone poderá exigir nova verificação.

---

## 15.3 Solicitar alteração de e-mail

```text
POST /api/v1/users/me/change-email
```

### Entrada

```json
{
  "newEmail": "novo@example.com",
  "password": "senha-atual"
}
```

### Resposta

```text
202 Accepted
```

### Regras

- confirmar senha;
- verificar unicidade;
- exigir confirmação do novo e-mail;
- manter e-mail anterior até confirmação.

---

## 15.4 Encerrar conta

```text
DELETE /api/v1/users/me
```

### Entrada

```json
{
  "password": "senha-atual",
  "reason": "Não utilizarei mais a plataforma."
}
```

### Resposta

```text
202 Accepted
```

### Regras

- confirmar identidade;
- avaliar contratos ativos;
- revogar sessões;
- iniciar exclusão, anonimização ou retenção;
- não apagar imediatamente registros obrigatórios;
- registrar auditoria.

---

## 15.5 Ativar papel de cliente

```text
POST /api/v1/users/me/roles/customer
```

### Resposta

```text
201 Created
```

### Regras

- não duplicar papel;
- criar `CustomerProfile` quando necessário;
- operação idempotente.

---

## 15.6 Ativar papel profissional

```text
POST /api/v1/users/me/roles/professional
```

### Entrada

```json
{
  "displayName": "Maria Serviços",
  "bio": "Profissional com experiência em serviços residenciais."
}
```

### Resposta

```text
201 Created
```

### Regras

- não duplicar papel;
- criar `ProfessionalProfile`;
- exigir dados mínimos;
- não atribuir verificação automaticamente.

---

# 16. Perfil profissional

## 16.1 Obter perfil profissional autenticado

```text
GET /api/v1/professional-profile/me
```

### Autenticação

Papel `PROFESSIONAL`.

---

## 16.2 Atualizar perfil profissional

```text
PATCH /api/v1/professional-profile/me
```

### Entrada

```json
{
  "displayName": "Maria Serviços",
  "bio": "Atendimento residencial e comercial.",
  "isAvailable": true
}
```

---

## 16.3 Listar categorias atendidas

```text
GET /api/v1/professional-profile/me/categories
```

---

## 16.4 Adicionar categoria

```text
POST /api/v1/professional-profile/me/categories
```

### Entrada

```json
{
  "categoryId": "uuid"
}
```

### Regras

- categoria ativa;
- impedir duplicação;
- perfil profissional ativo.

---

## 16.5 Remover categoria

```text
DELETE /api/v1/professional-profile/me/categories/{categoryId}
```

### Resposta

```text
204 No Content
```

---

## 16.6 Listar áreas de atendimento

```text
GET /api/v1/professional-profile/me/service-areas
```

---

## 16.7 Adicionar área de atendimento

```text
POST /api/v1/professional-profile/me/service-areas
```

### Entrada

```json
{
  "country": "BR",
  "state": "SP",
  "city": "Campinas"
}
```

---

## 16.8 Remover área de atendimento

```text
DELETE /api/v1/professional-profile/me/service-areas/{serviceAreaId}
```

---

## 16.9 Listar profissionais publicamente

```text
GET /api/v1/professionals
```

### Filtros iniciais

```text
categoryId
state
city
verificationStatus
isAvailable
minimumRating
page
limit
sort
```

### Regras

- não expor e-mail;
- não expor telefone;
- não expor endereço;
- não expor dados administrativos;
- exibir somente perfis elegíveis.

---

## 16.10 Obter perfil público

```text
GET /api/v1/professionals/{professionalId}
```

### Resposta conceitual

```json
{
  "data": {
    "id": "uuid",
    "displayName": "Maria Serviços",
    "bio": "Atendimento residencial e comercial.",
    "avatarUrl": "https://...",
    "verificationStatus": "APPROVED",
    "averageRating": 4.8,
    "reviewCount": 25,
    "servicesCompletedCount": 30,
    "isAvailable": true,
    "categories": [],
    "serviceAreas": []
  }
}
```

---

# 17. Categorias

## 17.1 Listar categorias

```text
GET /api/v1/categories
```

### Público

Sim.

### Filtros

```text
status
parentId
search
page
limit
```

Por padrão, usuários comuns receberão apenas categorias ativas.

---

## 17.2 Obter categoria

```text
GET /api/v1/categories/{categoryId}
```

---

# 18. Solicitações de serviço

## 18.1 Criar solicitação

```text
POST /api/v1/service-requests
```

### Autenticação

Papel `CUSTOMER`.

### Entrada

```json
{
  "categoryId": "uuid",
  "title": "Preciso instalar uma tomada",
  "description": "Preciso instalar uma tomada adicional na sala.",
  "location": {
    "country": "BR",
    "state": "SP",
    "city": "Campinas",
    "neighborhood": "Centro",
    "postalCode": "13000-000",
    "addressLine": "Rua Exemplo",
    "addressNumber": "100",
    "addressComplement": "Apartamento 10"
  },
  "fileIds": ["uuid"]
}
```

### Resposta

```text
201 Created
```

### Estado inicial

```text
DRAFT
```

### Regras

- cliente autenticado;
- categoria válida;
- arquivos pertencentes ao cliente;
- limites de título e descrição;
- endereço completo será privado;
- criação não significa publicação automática.

---

## 18.2 Listar minhas solicitações

```text
GET /api/v1/service-requests/mine
```

### Filtros

```text
status
categoryId
page
limit
sort
```

---

## 18.3 Obter solicitação própria

```text
GET /api/v1/service-requests/{serviceRequestId}
```

### Regras de exposição

O proprietário receberá os dados completos permitidos.

Profissionais elegíveis receberão uma versão limitada da localização.

---

## 18.4 Atualizar solicitação

```text
PATCH /api/v1/service-requests/{serviceRequestId}
```

### Regras

- somente proprietário;
- somente estados editáveis;
- status não poderá ser atualizado diretamente;
- alterações críticas poderão exigir nova validação;
- solicitação contratada não poderá ser editada livremente.

---

## 18.5 Publicar solicitação

```text
POST /api/v1/service-requests/{serviceRequestId}/publish
```

### Resposta

```text
200 OK
```

### Transição

```text
DRAFT → OPEN
```

### Regras

- proprietário;
- campos obrigatórios preenchidos;
- categoria ativa;
- localização válida;
- arquivos prontos;
- não permitir publicação duplicada.

---

## 18.6 Cancelar solicitação

```text
POST /api/v1/service-requests/{serviceRequestId}/cancel
```

### Entrada

```json
{
  "reason": "Não preciso mais do serviço."
}
```

### Regras

- proprietário ou administrador autorizado;
- validar estado atual;
- registrar motivo;
- impedir novas propostas;
- cancelar contratação quando aplicável conforme política oficial;
- gerar notificações.

---

## 18.7 Excluir rascunho

```text
DELETE /api/v1/service-requests/{serviceRequestId}
```

### Regras

- somente proprietário;
- preferencialmente apenas em `DRAFT`;
- exclusão lógica quando houver histórico;
- não utilizar para cancelar solicitação publicada.

---

## 18.8 Listar oportunidades profissionais

```text
GET /api/v1/opportunities
```

### Autenticação

Papel `PROFESSIONAL`.

### Filtros

```text
categoryId
state
city
status
page
limit
sort
```

### Regras

- mostrar apenas solicitações elegíveis;
- considerar categorias do profissional;
- considerar área de atendimento;
- ocultar endereço completo;
- não expor dados privados do cliente.

---

# 19. Propostas

## 19.1 Enviar proposta

```text
POST /api/v1/service-requests/{serviceRequestId}/proposals
```

### Autenticação

Papel `PROFESSIONAL`.

### Entrada

```json
{
  "amountInCents": 15000,
  "estimatedDurationValue": 2,
  "estimatedDurationUnit": "HOUR",
  "message": "Posso realizar o serviço amanhã pela manhã."
}
```

### Resposta

```text
201 Created
```

### Regras

- solicitação aceita propostas;
- profissional elegível;
- categoria atendida;
- região atendida;
- profissional não pode ser o cliente da solicitação;
- uma proposta por profissional e solicitação;
- valor maior que zero;
- prazo válido;
- proposta criada como `ACTIVE`.

---

## 19.2 Listar propostas recebidas

```text
GET /api/v1/service-requests/{serviceRequestId}/proposals
```

### Autenticação

Cliente proprietário.

### Filtros

```text
status
page
limit
sort
```

---

## 19.3 Listar minhas propostas

```text
GET /api/v1/proposals/mine
```

### Autenticação

Papel `PROFESSIONAL`.

### Filtros

```text
status
page
limit
sort
```

---

## 19.4 Obter proposta

```text
GET /api/v1/proposals/{proposalId}
```

### Autorização

- profissional proprietário;
- cliente proprietário da solicitação;
- administrador autorizado.

---

## 19.5 Atualizar proposta

```text
PATCH /api/v1/proposals/{proposalId}
```

### Entrada

```json
{
  "amountInCents": 17000,
  "estimatedDurationValue": 3,
  "estimatedDurationUnit": "HOUR",
  "message": "Atualizei o prazo estimado."
}
```

### Regras

- somente profissional proprietário;
- somente proposta `ACTIVE`;
- solicitação ainda aceita propostas;
- status não poderá ser alterado diretamente.

---

## 19.6 Retirar proposta

```text
POST /api/v1/proposals/{proposalId}/withdraw
```

### Transição

```text
ACTIVE → WITHDRAWN
```

### Regras

- somente profissional proprietário;
- não permitir retirada após aceite;
- registrar data;
- notificar cliente quando necessário.

---

## 19.7 Aceitar proposta

```text
POST /api/v1/proposals/{proposalId}/accept
```

### Autenticação

Cliente proprietário da solicitação.

### Cabeçalho recomendado

```http
Idempotency-Key: identificador-unico
```

### Resposta

```text
201 Created
```

```json
{
  "data": {
    "contract": {
      "id": "uuid",
      "status": "ACCEPTED",
      "agreedAmountInCents": 15000,
      "acceptedAt": "2026-07-30T22:15:00.000Z"
    },
    "conversation": {
      "id": "uuid",
      "status": "ACTIVE"
    }
  }
}
```

### Transação

A operação deverá:

1. validar cliente;
2. validar solicitação;
3. validar proposta ativa;
4. impedir contratação duplicada;
5. aceitar a proposta;
6. rejeitar demais propostas ativas;
7. criar contratação;
8. atualizar solicitação para `HIRED`;
9. criar conversa;
10. criar notificações.

---

# 20. Contratações

## 20.1 Listar minhas contratações

```text
GET /api/v1/contracts
```

### Filtros

```text
role
status
page
limit
sort
```

O backend identificará se o usuário participa como cliente ou profissional.

---

## 20.2 Obter contratação

```text
GET /api/v1/contracts/{contractId}
```

### Autorização

- cliente participante;
- profissional participante;
- administrador autorizado.

---

## 20.3 Iniciar serviço

```text
POST /api/v1/contracts/{contractId}/start
```

### Cabeçalho recomendado

```http
Idempotency-Key: identificador-unico
```

### Transição

```text
ACCEPTED → IN_PROGRESS
```

### Regras

- participante autorizado;
- estado atual válido;
- registrar `startedAt`;
- atualizar solicitação;
- criar notificações.

A regra exata sobre qual participante poderá confirmar o início será definida no documento de regras de negócio antes da implementação.

---

## 20.4 Concluir serviço

```text
POST /api/v1/contracts/{contractId}/complete
```

### Cabeçalho recomendado

```http
Idempotency-Key: identificador-unico
```

### Transição

```text
IN_PROGRESS → COMPLETED
```

### Regras

- participante autorizado;
- estado válido;
- atualizar solicitação;
- registrar conclusão;
- atualizar histórico profissional;
- liberar avaliação;
- criar notificações.

A regra de confirmação unilateral ou bilateral será definida antes da implementação.

---

## 20.5 Cancelar contratação

```text
POST /api/v1/contracts/{contractId}/cancel
```

### Entrada

```json
{
  "reason": "O serviço não poderá mais ser realizado."
}
```

### Transição

```text
ACCEPTED → CANCELLED
IN_PROGRESS → CANCELLED
```

### Regras

- validar participante;
- validar estado;
- registrar motivo;
- registrar responsável;
- atualizar solicitação;
- tratar conversa;
- gerar notificações;
- gerar auditoria em ações administrativas.

A política detalhada ainda será documentada.

---

# 21. Conversas e mensagens

## 21.1 Listar conversas

```text
GET /api/v1/conversations
```

### Autenticação

Obrigatória.

### Filtros

```text
status
page
limit
```

A resposta deverá incluir:

- participante;
- contratação relacionada;
- última mensagem permitida;
- data da última atividade;
- quantidade de mensagens não lidas.

---

## 21.2 Obter conversa

```text
GET /api/v1/conversations/{conversationId}
```

### Regra

Somente participantes ou administradores autorizados.

---

## 21.3 Listar mensagens

```text
GET /api/v1/conversations/{conversationId}/messages
```

### Parâmetros

```text
before
limit
```

### Exemplo

```text
GET /api/v1/conversations/{id}/messages?before={messageId}&limit=30
```

### Resposta

```json
{
  "data": [
    {
      "id": "uuid",
      "senderUserId": "uuid",
      "content": "Olá, podemos combinar o horário?",
      "status": "SENT",
      "sentAt": "2026-07-30T22:15:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": "uuid",
    "hasMore": true
  }
}
```

---

## 21.4 Enviar mensagem por REST

```text
POST /api/v1/conversations/{conversationId}/messages
```

### Entrada

```json
{
  "content": "Olá, podemos combinar o horário?"
}
```

### Resposta

```text
201 Created
```

### Regras

- participante autenticado;
- conversa ativa;
- conteúdo não vazio;
- limite de caracteres;
- persistir antes de emitir evento;
- remetente definido pelo backend.

O endpoint REST poderá servir como alternativa ou suporte ao WebSocket.

---

## 21.5 Marcar conversa como lida

```text
POST /api/v1/conversations/{conversationId}/read
```

### Entrada

```json
{
  "lastReadMessageId": "uuid"
}
```

### Resposta

```text
204 No Content
```

### Regras

- usuário participante;
- mensagem pertence à conversa;
- ponto de leitura não poderá retroceder.

---

# 22. WebSockets

## 22.1 Namespace

```text
/chat
```

O endereço definitivo acompanhará o domínio da API.

## 22.2 Autenticação

A conexão deverá utilizar access token válido.

O backend deverá validar:

- token;
- usuário;
- status da conta;
- sessão quando aplicável.

## 22.3 Eventos enviados pelo cliente

```text
conversation:join
conversation:leave
message:send
conversation:read
```

## 22.4 Eventos enviados pelo servidor

```text
message:created
message:failed
conversation:updated
conversation:read
notification:created
```

## 22.5 Exemplo de envio

```json
{
  "conversationId": "uuid",
  "clientMessageId": "uuid-gerado-pelo-cliente",
  "content": "Olá, podemos combinar o horário?"
}
```

## 22.6 Exemplo de confirmação

```json
{
  "clientMessageId": "uuid-gerado-pelo-cliente",
  "message": {
    "id": "uuid-gerado-pelo-servidor",
    "conversationId": "uuid",
    "senderUserId": "uuid",
    "content": "Olá, podemos combinar o horário?",
    "sentAt": "2026-07-30T22:15:00.000Z"
  }
}
```

## 22.7 Regras

- não confiar no remetente enviado pelo cliente;
- validar acesso em todas as operações;
- persistir mensagem antes da emissão;
- impedir entrada em conversa não autorizada;
- aplicar limite de frequência;
- não utilizar WebSocket como fonte oficial;
- utilizar Redis somente quando houver múltiplas instâncias ou necessidade comprovada.

---

# 23. Avaliações

## 23.1 Criar avaliação

```text
POST /api/v1/contracts/{contractId}/review
```

### Autenticação

Cliente da contratação.

### Entrada

```json
{
  "rating": 5,
  "comment": "Ótimo atendimento."
}
```

### Resposta

```text
201 Created
```

### Regras

- contratação concluída;
- cliente participante;
- uma avaliação por contratação;
- nota entre 1 e 5;
- comentário opcional;
- atualizar média do profissional em transação.

---

## 23.2 Obter avaliação da contratação

```text
GET /api/v1/contracts/{contractId}/review
```

### Autorização

Participantes ou administrador autorizado.

---

## 23.3 Listar avaliações do profissional

```text
GET /api/v1/professionals/{professionalId}/reviews
```

### Público

Sim, apenas avaliações publicadas.

### Filtros

```text
rating
page
limit
sort
```

---

# 24. Favoritos

## 24.1 Listar favoritos

```text
GET /api/v1/favorites
```

### Autenticação

Papel `CUSTOMER`.

---

## 24.2 Adicionar favorito

```text
POST /api/v1/favorites
```

### Entrada

```json
{
  "professionalId": "uuid"
}
```

### Resposta

```text
201 Created
```

### Regras

- profissional válido;
- impedir duplicação;
- não gerar comunicação automática.

---

## 24.3 Remover favorito

```text
DELETE /api/v1/favorites/{professionalId}
```

### Resposta

```text
204 No Content
```

---

# 25. Notificações

## 25.1 Listar notificações

```text
GET /api/v1/notifications
```

### Filtros

```text
read
type
page
limit
```

---

## 25.2 Obter quantidade não lida

```text
GET /api/v1/notifications/unread-count
```

### Resposta

```json
{
  "data": {
    "count": 3
  }
}
```

---

## 25.3 Marcar notificação como lida

```text
POST /api/v1/notifications/{notificationId}/read
```

### Resposta

```text
204 No Content
```

---

## 25.4 Marcar todas como lidas

```text
POST /api/v1/notifications/read-all
```

### Resposta

```text
204 No Content
```

---

## 25.5 Remover notificação

```text
DELETE /api/v1/notifications/{notificationId}
```

### Resposta

```text
204 No Content
```

A remoção seguirá a política de retenção.

---

# 26. Uploads

## 26.1 Solicitar autorização de upload

```text
POST /api/v1/uploads/presign
```

### Entrada

```json
{
  "purpose": "SERVICE_REQUEST_IMAGE",
  "originalName": "foto.jpg",
  "mimeType": "image/jpeg",
  "sizeInBytes": 1200000
}
```

### Resposta

```json
{
  "data": {
    "fileId": "uuid",
    "uploadUrl": "https://storage...",
    "expiresAt": "2026-07-30T22:30:00.000Z",
    "requiredHeaders": {
      "Content-Type": "image/jpeg"
    }
  }
}
```

### Regras

- usuário autenticado;
- finalidade permitida;
- tipo permitido;
- tamanho permitido;
- nome interno gerado;
- arquivo criado inicialmente como `PENDING`.

---

## 26.2 Confirmar upload

```text
POST /api/v1/uploads/{fileId}/complete
```

### Cabeçalho recomendado

```http
Idempotency-Key: identificador-unico
```

### Resposta

```text
202 Accepted
```

### Regras

- arquivo pertence ao usuário;
- verificar existência no armazenamento;
- validar tamanho e tipo;
- iniciar processamento;
- não marcar como pronto sem validação.

---

## 26.3 Obter estado do arquivo

```text
GET /api/v1/uploads/{fileId}
```

### Resposta

```json
{
  "data": {
    "id": "uuid",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeInBytes": 1200000,
    "url": "https://..."
  }
}
```

URLs privadas deverão ser assinadas ou temporárias.

---

## 26.4 Excluir arquivo

```text
DELETE /api/v1/uploads/{fileId}
```

### Regras

- proprietário;
- verificar vínculos;
- remover ou marcar para exclusão;
- coordenar banco e armazenamento.

---

# 27. Verificação

## 27.1 Obter estado de verificação

```text
GET /api/v1/verifications/me
```

---

## 27.2 Solicitar verificação básica profissional

```text
POST /api/v1/verifications/professional-basic
```

### Entrada

Os campos definitivos serão definidos quando o fluxo de verificação for implementado.

### Resposta

```text
202 Accepted
```

### Regras

- perfil profissional;
- impedir solicitação duplicada em análise;
- coletar somente dados necessários;
- registrar estado `PENDING`.

---

# 28. Denúncias

## 28.1 Criar denúncia

```text
POST /api/v1/reports
```

### Entrada

```json
{
  "targetType": "MESSAGE",
  "targetId": "uuid",
  "reason": "OFFENSIVE_CONTENT",
  "description": "Descrição opcional do problema."
}
```

### Resposta

```text
201 Created
```

### Regras

- usuário autenticado;
- alvo existente;
- motivo permitido;
- aplicar limite contra abuso;
- não remover conteúdo automaticamente sem regra específica.

---

## 28.2 Listar minhas denúncias

```text
GET /api/v1/reports/mine
```

### Regras

O usuário não receberá informações internas da análise.

---

# 29. Administração

Todos os endpoints administrativos utilizarão:

```text
/api/v1/admin
```

O acesso exigirá papel administrativo e autorização específica.

## 29.1 Dashboard

```text
GET /api/v1/admin/dashboard
```

### Indicadores iniciais

- usuários cadastrados;
- clientes;
- profissionais;
- solicitações abertas;
- propostas;
- contratações;
- serviços concluídos;
- denúncias pendentes.

---

## 29.2 Listar usuários

```text
GET /api/v1/admin/users
```

### Filtros

```text
status
role
search
page
limit
sort
```

---

## 29.3 Obter usuário

```text
GET /api/v1/admin/users/{userId}
```

Dados sensíveis deverão ser limitados conforme a necessidade administrativa.

O acesso deverá ser auditado quando aplicável.

---

## 29.4 Suspender usuário

```text
POST /api/v1/admin/users/{userId}/suspend
```

### Entrada

```json
{
  "reason": "Violação dos termos de uso."
}
```

---

## 29.5 Bloquear usuário

```text
POST /api/v1/admin/users/{userId}/block
```

### Entrada

```json
{
  "reason": "Fraude confirmada."
}
```

### Regras

- exigir motivo;
- revogar sessões;
- registrar ação;
- criar auditoria;
- notificar usuário quando apropriado.

---

## 29.6 Desbloquear usuário

```text
POST /api/v1/admin/users/{userId}/unblock
```

### Entrada

```json
{
  "reason": "Bloqueio revisado pela moderação."
}
```

---

## 29.7 Criar categoria

```text
POST /api/v1/admin/categories
```

### Entrada

```json
{
  "name": "Eletricista",
  "slug": "eletricista",
  "description": "Serviços elétricos residenciais e comerciais.",
  "icon": "zap",
  "parentId": null
}
```

---

## 29.8 Atualizar categoria

```text
PATCH /api/v1/admin/categories/{categoryId}
```

---

## 29.9 Desativar categoria

```text
POST /api/v1/admin/categories/{categoryId}/deactivate
```

---

## 29.10 Reativar categoria

```text
POST /api/v1/admin/categories/{categoryId}/activate
```

---

## 29.11 Listar denúncias

```text
GET /api/v1/admin/reports
```

### Filtros

```text
status
targetType
page
limit
sort
```

---

## 29.12 Atualizar denúncia

```text
PATCH /api/v1/admin/reports/{reportId}
```

### Entrada

```json
{
  "status": "UNDER_REVIEW"
}
```

Esse é um dos poucos casos em que a alteração direta de status poderá ser permitida, desde que as transições sejam validadas.

---

## 29.13 Resolver denúncia

```text
POST /api/v1/admin/reports/{reportId}/resolve
```

### Entrada

```json
{
  "resolution": "Conteúdo removido e usuário advertido.",
  "actions": [
    {
      "type": "REMOVE_CONTENT",
      "targetType": "MESSAGE",
      "targetId": "uuid"
    }
  ]
}
```

### Regras

- executar ações autorizadas;
- registrar moderador;
- registrar motivo;
- criar auditoria;
- não expor dados internos ao denunciante.

---

## 29.14 Listar auditoria

```text
GET /api/v1/admin/audit-logs
```

### Acesso

Somente administradores com permissão específica.

### Filtros

```text
actorUserId
action
resourceType
resourceId
dateFrom
dateTo
page
limit
```

---

# 30. Health checks

## 30.1 Disponibilidade do processo

```text
GET /health/live
```

### Resposta

```text
200 OK
```

Esse endpoint não deverá depender de serviços externos.

---

## 30.2 Prontidão

```text
GET /health/ready
```

### Verificações iniciais

- aplicação inicializada;
- PostgreSQL acessível;
- dependências obrigatórias disponíveis.

Redis somente será verificado quando for uma dependência ativa.

---

# 31. Rate limiting

Rate limiting deverá ser aplicado principalmente em:

```text
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/resend-email-verification
POST /reports
POST /uploads/presign
POST /conversations/{id}/messages
```

Os limites definitivos serão configurados por ambiente.

### Resposta

```text
429 Too Many Requests
```

```json
{
  "error": {
    "statusCode": 429,
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Muitas tentativas. Aguarde antes de tentar novamente.",
    "requestId": "uuid",
    "timestamp": "2026-07-30T22:15:00.000Z"
  }
}
```

---

# 32. Validação

Todas as entradas deverão ser validadas.

A validação poderá envolver:

- tipos;
- tamanhos;
- formatos;
- enumerações;
- campos obrigatórios;
- relações;
- estado atual;
- propriedade;
- permissões;
- existência do recurso.

DTOs do NestJS serão responsáveis pela validação estrutural.

Serviços serão responsáveis pelas regras de negócio.

---

# 33. Segurança

A API deverá implementar progressivamente:

- HTTPS;
- CORS restrito;
- rate limiting;
- validação global;
- remoção de campos desconhecidos;
- headers de segurança;
- hash seguro de senha;
- refresh token com rotação;
- autorização por recurso;
- proteção contra SQL Injection;
- proteção contra XSS;
- proteção contra CSRF quando aplicável;
- limites de upload;
- logs sem dados sensíveis;
- auditoria administrativa;
- tratamento global de erros.

### CORS

O backend deverá permitir apenas origens autorizadas.

Requisições com cookies deverão configurar credenciais explicitamente.

### Validação global recomendada

O NestJS deverá utilizar configuração equivalente a:

```text
whitelist: true
forbidNonWhitelisted: true
transform: true
```

A implementação será realizada no commit de configuração da API.

---

# 34. Privacidade

A API não deverá expor publicamente:

- e-mail;
- telefone;
- endereço completo;
- sessões;
- tokens;
- IP completo;
- dados de verificação;
- informações administrativas;
- denúncias internas;
- auditoria;
- arquivos privados;
- dados pessoais desnecessários.

Cada DTO de saída deverá conter somente os campos necessários para seu contexto.

Entidades do Prisma não deverão ser retornadas diretamente pelos controllers.

---

# 35. OpenAPI

A documentação será gerada com Swagger/OpenAPI.

O ambiente de desenvolvimento poderá disponibilizar:

```text
/api/docs
```

A documentação deverá incluir:

- endpoints;
- parâmetros;
- corpos;
- respostas;
- erros;
- autenticação;
- exemplos;
- estados possíveis;
- descrição das permissões.

A exposição em produção deverá ser decidida posteriormente.

---

# 36. Versionamento

Mudanças incompatíveis não deverão alterar silenciosamente contratos existentes.

A versão inicial será:

```text
/api/v1
```

Uma futura versão incompatível poderá utilizar:

```text
/api/v2
```

Novos campos opcionais poderão ser adicionados sem criar nova versão, desde que não quebrem clientes existentes.

---

# 37. Testes da API

## 37.1 Testes unitários

Prioridade para:

- autenticação;
- autorização;
- transições;
- envio de proposta;
- aceite de proposta;
- criação de contratação;
- conclusão;
- avaliação.

## 37.2 Testes de integração

Prioridade para:

- controllers;
- services;
- Prisma;
- PostgreSQL;
- transações;
- restrições únicas;
- tratamento de erros.

## 37.3 Testes E2E

Fluxo principal:

1. cadastrar cliente;
2. autenticar;
3. criar solicitação;
4. publicar solicitação;
5. cadastrar profissional;
6. configurar categoria;
7. listar oportunidade;
8. enviar proposta;
9. aceitar proposta;
10. criar contratação;
11. acessar conversa;
12. enviar mensagem;
13. iniciar serviço;
14. concluir serviço;
15. avaliar profissional.

---

# 38. Ordem de implementação

A API será implementada incrementalmente.

## Etapa 1 — Fundação

```text
health
config
database
auth
users
customer profiles
professional profiles
```

## Etapa 2 — Categorias e solicitações

```text
categories
professional categories
service areas
service requests
uploads
```

## Etapa 3 — Propostas e contratação

```text
opportunities
proposals
contracts
```

## Etapa 4 — Comunicação

```text
conversations
messages
WebSockets
notifications
```

## Etapa 5 — Relacionamento

```text
reviews
favorites
```

## Etapa 6 — Operação

```text
verification
reports
moderation
admin
audit logs
```

Não serão implementados todos os endpoints em um único commit.

---

# 39. Decisões pendentes

Ainda precisam de definição de negócio:

1. Quem poderá confirmar o início do serviço.
2. Se a conclusão será unilateral ou bilateral.
3. Política de cancelamento após o início.
4. Limites de caracteres de mensagens e descrições.
5. Quantidade máxima de imagens por solicitação.
6. Tamanho máximo de arquivos.
7. Tipos de arquivos permitidos.
8. Tempo de expiração do access token.
9. Tempo de expiração do refresh token.
10. Limites exatos de rate limiting.
11. Política de retenção de mensagens.
12. Política de retenção de notificações.
13. Exposição da documentação Swagger em produção.

Essas decisões deverão ser aprovadas e registradas antes da implementação correspondente.

---

# 40. Decisões oficializadas

Este documento oficializa:

1. API REST versionada em `/api/v1`.
2. JSON e UTF-8 como formatos oficiais.
3. HTTPS obrigatório fora do ambiente local.
4. Access token enviado como Bearer token.
5. Refresh token enviado em cookie seguro.
6. Sessões persistidas no PostgreSQL.
7. Respostas e erros padronizados.
8. Identificador de requisição.
9. Paginação obrigatória em listagens.
10. Paginação por cursor para mensagens.
11. Ações explícitas para transições críticas.
12. Aceite de proposta como operação transacional.
13. Chat somente após contratação.
14. WebSocket como canal de entrega, não como fonte de dados.
15. PostgreSQL como fonte oficial de mensagens e notificações.
16. Upload direto para armazenamento através de URL assinada.
17. Endereço completo protegido.
18. DTOs de saída separados das entidades Prisma.
19. Autorização por papel, propriedade e estado.
20. Rate limiting em endpoints sensíveis.
21. Documentação OpenAPI.
22. Implementação incremental dos módulos.

---

# 41. Diretriz final

A API da Soravi deverá ser segura, previsível e orientada às regras de negócio.

Os endpoints não deverão representar apenas operações genéricas de banco de dados.

Cada ação crítica deverá expressar claramente a intenção do usuário, validar o estado atual e preservar a consistência da plataforma.

A implementação será incremental, acompanhando o modelo de dados, a arquitetura e as decisões oficiais do projeto.