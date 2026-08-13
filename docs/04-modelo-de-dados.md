# 04 - Modelo de Dados

# Objetivo

Definir as principais entidades da plataforma Soravi e seus
relacionamentos.

------------------------------------------------------------------------

# Entidades Principais

## Usuário (User)

Campos principais: - id - nome - email - senha - telefone - foto - tipo
(CLIENTE \| PROFISSIONAL \| ADMIN) - status - data_criacao

Relacionamentos: - 1 Cliente ou 1 Profissional - várias notificações -
várias mensagens

------------------------------------------------------------------------

## Cliente

Relacionamentos: - várias solicitações - várias avaliações realizadas -
profissionais favoritos

------------------------------------------------------------------------

## Profissional

Campos adicionais: - descrição - categorias - área de atendimento - nota
média - quantidade de avaliações

Relacionamentos: - várias propostas - várias avaliações recebidas

------------------------------------------------------------------------

## Categoria

Exemplos: - Eletricista - Encanador - Pintor - Jardineiro - Diarista

Uma categoria possui vários profissionais e várias solicitações.

------------------------------------------------------------------------

## Solicitação

Campos: - título - descrição - categoria - localização - status - data

Relacionamentos: - pertence a um cliente - recebe várias propostas

------------------------------------------------------------------------

## Proposta

Campos: - valor - prazo - mensagem - status

Relacionamentos: - pertence a um profissional - pertence a uma
solicitação

------------------------------------------------------------------------

## Conversa (Chat)

Criada somente após contratação.

Relacionamentos: - cliente - profissional - mensagens

------------------------------------------------------------------------

## Mensagem

Campos: - texto - remetente - data - lida

------------------------------------------------------------------------

## Avaliação

Campos: - nota - comentário - data

Relacionamentos: - cliente - profissional

------------------------------------------------------------------------

## Favoritos

Permite ao cliente salvar profissionais.

------------------------------------------------------------------------

## Notificações

Tipos: - nova proposta - mensagem - contratação - avaliação - avisos da
plataforma

------------------------------------------------------------------------

# Relacionamentos Principais

Cliente → Solicitações

Solicitação → Propostas

Profissional → Propostas

Proposta → Contratação

Contratação → Chat

Chat → Mensagens

Cliente → Avaliações

Profissional → Avaliações

------------------------------------------------------------------------

# Evolução

O modelo poderá ser expandido futuramente com: - pagamentos; -
assinatura premium; - cupons; - agenda; - geolocalização em tempo
real; - inteligência artificial.

## Autenticação e sessões

### AuthSession

Representa uma sessão autenticada de usuário.

Campos principais:

- `id`;
- `userId`;
- `refreshTokenHash`;
- `userAgent`;
- `ipAddress`;
- `expiresAt`;
- `lastUsedAt`;
- `revokedAt`;
- `createdAt`.

Regras:

- o refresh token original não é armazenado;
- somente o hash do refresh token é persistido;
- cada renovação substitui o hash anterior;
- uma sessão revogada ou expirada não pode ser utilizada;
- o campo `lastUsedAt` registra o último uso da sessão;
- o campo `revokedAt` registra o encerramento da sessão.

## Categorias de serviços

### Category

Representa uma categoria oficial e aprovada pela Soravi.

Campos principais:

- `id`;
- `name`;
- `slug`;
- `description`;
- `icon`;
- `isActive`;
- `displayOrder`;
- `createdAt`;
- `updatedAt`.

Regras:

- o `slug` deve ser único;
- somente categorias ativas aparecem na listagem pública;
- categorias podem ser desativadas sem exclusão definitiva;
- `displayOrder` controla a ordem de apresentação;
- a categoria poderá receber solicitações que foram aprovadas ou vinculadas.

### Lista oficial inicial do MVP (2026-08-12)

Para o primeiro MVP, a lista oficial inicial de `Category` é:

1. Eletricista (`eletricista`)
2. Encanador (`encanador`)
3. Pintor (`pintor`)
4. Diarista (`diarista`)
5. Jardineiro (`jardineiro`)
6. Montador de móveis (`montador-de-moveis`)
7. Climatização e ar-condicionado (`climatizacao-e-ar-condicionado`)
8. Reparos e manutenção residencial (`reparos-e-manutencao-residencial`)

Observações:

- "Montador" não é nome oficial de categoria;
- "Reformas" não é categoria separada neste primeiro MVP;
- a ordem oficial inicial deve ser preservada de 1 a 8.

### CategoryRequest

Representa uma solicitação de inclusão de uma categoria feita por um profissional.

Campos principais:

- `id`;
- `professionalProfileId`;
- `suggestedName`;
- `suggestedNameNormalized`;
- `description`;
- `status`;
- `reviewNotes`;
- `resolvedCategoryId`;
- `reviewedByUserId`;
- `reviewedAt`;
- `createdAt`;
- `updatedAt`.

Relações:

- pertence a um `ProfessionalProfile`;
- pode ser analisada por um `User` administrador ou moderador;
- pode ser vinculada a uma `Category`;
- o profissional pode possuir várias solicitações.

### CategoryRequestStatus

Estados possíveis:

- `PENDING`: aguardando análise;
- `APPROVED`: solicitação aprovada;
- `REJECTED`: solicitação recusada;
- `MERGED`: vinculada a uma categoria oficial já existente.

Regras:

- a ausência de categoria não bloqueia o cadastro profissional;
- `suggestedNameNormalized` auxilia na busca de solicitações semelhantes;
- solicitações iguais não possuem restrição única, pois a quantidade também representa demanda;
- solicitações pendentes não aparecem na busca pública.

## Pré-cadastro de interesse (LaunchInterest)

Representa um registro de usuário interessado no lançamento da Soravi, coletado no formulário "Acompanhe o lançamento".

Características e regras:

- não cria conta de `User` nem sessão autenticada;
- campos principais: `id`, `name`, `email`, `emailNormalized`, `phone`, `phoneNormalized`, `audienceType`, `city`, `state`, `serviceInterest`, `professionalCategoryInterest`, `source`, `privacyNoticeAcceptedAt`, `marketingConsentAt`, `emailConfirmedAt`, `unsubscribedAt`, `createdAt`, `updatedAt`;
- `emailNormalized` é único entre registros de interesse para evitar duplicidade de envios;
- `privacyNoticeAcceptedAt` é obrigatório e registra o aceite do aviso de privacidade;
- `marketingConsentAt` é opcional e registra consentimento de marketing quando presente;
- o telefone é opcional e deve ser armazenado normalizado quando fornecido;
- confirmação por e-mail (`emailConfirmedAt`) é prevista para implementação futura;
- o registro permite que o usuário seja marcado como cancelado via `unsubscribedAt`.

## Expansão futura para crescimento orgânico e Hub de Problemas

No futuro, o modelo conceitual poderá incorporar entidades adicionais para suportar descoberta por problema, geografia e conteúdo editorial.

### Entidades futuras

- `State`: representa um estado ou unidade federativa;
- `City`: representa uma cidade vinculada a um estado;
- `Neighborhood`: representa um bairro ou região local;
- `Problem`: representa um problema comum que o usuário deseja resolver;
- `ProblemCategory`: representa a recomendação de categoria para um problema, sem duplicar `Category`;
- `ContentArticle`: representa conteúdo educativo ou informativo;
- `ProfessionalPublicProfile`: representa a versão pública e indexável do perfil do profissional;
- `SlugHistory`: registra histórico de slugs públicos para controle de mudanças;
- `SeoMetadata`: representa metadados públicos, canonicals e dados estruturados;
- `Redirect`: representa redirecionamentos 301 para URLs antigas ou alteradas.

### Arquitetura geográfica futura

A estrutura conceitual deverá considerar o relacionamento entre:

- país;
- estado;
- cidade;
- bairro;
- categoria;
- profissional;
- problema;
- conteúdo.

### Regras conceituais

- URLs públicas nunca devem expor IDs internos;
- slugs amigáveis devem ser únicos e normalizados sem acentos;
- o sistema deve prever controle de colisões, palavras reservadas e histórico de slugs;
- páginas públicas só devem ser publicadas quando houver conteúdo real, categoria ativa, metadata completa, canonical definido, CTA funcional, ausência de duplicidade relevante e revisão editorial;
- se os critérios mínimos não forem atendidos, a página pode ser mantida sem indexação, retornar 404 quando aplicável ou permanecer sem publicação;
- o Hub de Problemas será uma capacidade central futura da Soravi, não uma simples coleção de páginas isoladas.