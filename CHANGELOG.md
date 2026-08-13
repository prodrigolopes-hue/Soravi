# Changelog

## 2026-08-12

### Administração

- criada a rota administrativa `/admin/categorias`;
- implementada tela administrativa read-only com duas áreas:
  - categorias oficiais;
  - solicitações de categoria;
- consumo do endpoint `GET /api/v1/categories/admin` com `page` e `pageSize`;
- consumo do endpoint `GET /api/v1/category-requests/admin` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403` por seção;
- paginações independentes entre categorias e solicitações;
- renderização com tabela no desktop e cards no mobile;
- card `Categorias` marcado como disponível no painel `/admin`.

### Backend

- criada a listagem administrativa `GET /api/v1/categories/admin`;
- autenticação via Bearer access token e autorização restrita a `ADMIN`;
- retorno de categorias ativas e inativas com paginação;
- ordenação por `displayOrder` asc e `name` asc;
- campos retornados: `id`, `name`, `slug`, `isActive`, `displayOrder`, `createdAt`, `updatedAt`.

- criada a listagem administrativa `GET /api/v1/category-requests/admin`;
- autenticação via Bearer access token e autorização restrita a `ADMIN`;
- retorno de solicitações de todos os status com paginação;
- ordenação por `createdAt` desc;
- campos principais retornados: `suggestedName`, `status`, `reviewNotes`, `professionalProfile`, `resolvedCategory`, `createdAt`, `reviewedAt`.

### Administração

- criada a rota administrativa `/admin/profissionais`;
- implementada listagem administrativa read-only de profissionais;
- consumo do endpoint `GET /api/v1/users/admin/professionals` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403`;
- paginação com cards no mobile e tabela no desktop;
- card `Profissionais` marcado como disponível no painel `/admin`;
- exibição administrativa de status da conta, verificação profissional e disponibilidade.

## 2026-08-12

### Administração

- criada a rota administrativa `/admin/clientes`;
- implementada listagem administrativa read-only de clientes;
- consumo do endpoint `GET /api/v1/users/admin/customers` com `page` e `pageSize`;
- proteção visual por sessão autenticada e role `ADMIN`;
- estados de loading, vazio, erro, `401` e `403`;
- paginação com cards no mobile e tabela no desktop;
- card `Clientes` marcado como disponível no painel `/admin`.

## 2026-08-11

### Autenticação

- corrigida a restauração da sessão autenticada após reload e navegação completa;
- refresh token mantido em cookie HttpOnly;
- access token mantido apenas em memória;
- evitadas corridas entre refresh automático, signIn e signOut;
- `GET /api/v1/users/me` ajustado para aceitar a resposta real da API e evitar cache indevido.

### Administração

- criada a rota `/admin/interessados`;
- implementada listagem administrativa paginada de interessados do lançamento;
- proteção visual restrita a usuário autenticado com role `ADMIN`;
- proteção real mantida no backend com `AccessTokenGuard` + `RolesGuard` + `Role.ADMIN`;
- interface com cards no mobile e tabela no desktop;
- estados de loading, vazio, erro, `401` e `403`;
- exibição correta de consentimento e descadastro de marketing;
- rota administrativa marcada como `noindex`.

## 2026-08-10

### Produto / Operação — Curadoria Inicial de Profissionais

- definida estratégia de curadoria inicial assíncrona para profissionais;
- removida entrevista obrigatória para todos os profissionais;
- contato humano passa a ser utilizado por exceção e risco;
- definida curadoria em quatro camadas:
  - cadastro estruturado;
  - verificação básica;
  - evidências + questionário;
  - classificação operacional de risco;
- aprovação/análise passa a ser resultado ou encaminhamento após as quatro camadas;
- presença digital definida como evidência complementar, não obrigatória;
- questionário por categoria não representa certificação técnica;
- CPF/CNPJ passa a ser solicitado somente quando necessário à verificação;
- classificação baixo/moderado/alto registrada como instrumento operacional não automatizado;
- padronização de nomenclatura para análise manual/adicional no piloto;
- não aprovação passa a admitir reavaliação quando aplicável;
- suspensões preventivas deverão possuir motivo registrado e revisão administrativa;
- reforçados princípios de minimização de dados e LGPD;
- nenhuma API, migration, tabela, tela ou automação foi implementada nesta alteração.

## 0.1.2 — Documentação (2026-08-06)
- Incorporada à documentação oficial a estratégia de crescimento orgânico, SEO programático responsável e Hub de Problemas como evolução futura da Soravi.

## 0.1.3 — Consentimento de cookies (2026-08-06)
- Implementado o primeiro estágio do banner de consentimento de cookies com persistência segura em localStorage, opções de aceitar ou recusar analytics e reabertura pelo rodapé.
- Integrado o Google Analytics 4 de forma condicionada ao consentimento do usuário, sem carregar scripts antes da aceitação.

## 0.1.0 — Commit 001: Fundação
- Monorepo
- Web Next.js
- API NestJS
- PostgreSQL e Redis
- Documentação inicial
- Página inicial de entrada.
- Formulário de login com validação de e-mail e senha.
- Controle para mostrar ou ocultar a senha.
- Página de escolha do tipo de conta.
- Jornadas separadas para clientes e profissionais.
- Componente reutilizável para opções de cadastro.
- Formulário inicial de cadastro de cliente.
- Validação de nome, e-mail, telefone e senha.
- Confirmação de senha e aceite dos documentos jurídicos.
- Formulário inicial de cadastro profissional.
- Seleção de categorias e região de atendimento.
- Validação de descrição, contato, senha e documentos jurídicos.
- Estrutura inicial dos Termos de Uso.
- Estrutura inicial da Política de Privacidade.
- Aviso de revisão jurídica pendente nas páginas legais.
- Página inicial de recuperação de senha.
- Validação do e-mail utilizado na solicitação.
- Mensagem neutra para proteção das contas cadastradas.
- Página inicial de redefinição de senha.
- Validação de senha segura e confirmação.
- Verificação da presença do token de recuperação.
- Aplicação da logo oficial da Soravi no Header e no Footer.
- Inclusão dos ativos iniciais da identidade visual.
- Configuração inicial segura da API.
- Prefixo global `/api/v1`.
- Validação de entradas e variáveis de ambiente.
- CORS restrito e cabeçalhos de segurança.
- Health Check padronizado.
- Correção das mensagens de validação da autenticação.
- Login ajustado para responder com HTTP 200.
- Registro da data do último login válido.
- Tratamento separado para e-mail e telefone duplicados.
- Regra de senha alinhada entre frontend e backend.
- Emissão inicial de access token e refresh token no login.
- Criação de sessão autenticada no PostgreSQL.
- Armazenamento protegido do hash do refresh token.
- Configuração de validade dos tokens por variáveis de ambiente.
- Renovação de access token com rotação segura do refresh token.
- Prevenção de reutilização de refresh tokens antigos.
- Encerramento de sessão por logout.
- Revogação de sessões no PostgreSQL.
- Testes automatizados de refresh e logout.
- Validação de access token JWT em rotas protegidas.
- Verificação da sessão autenticada no PostgreSQL.
- Invalidação de access tokens vinculados a sessões revogadas ou expiradas.
- Criação da rota protegida `GET /api/v1/users/me`.
- Testes automatizados do guard JWT e do controller de usuários.
- Autorização de rotas por papéis de usuário.
- Criação do decorator `@Roles`.
- Criação do `RolesGuard`.
- Resposta `INSUFFICIENT_PERMISSIONS` para acessos não autorizados.
- Validação de acesso profissional com testes automatizados.
- Criação do modelo de categorias de serviços.
- Criação do fluxo de solicitações de novas categorias por profissionais.
- Inclusão dos estados `PENDING`, `APPROVED`, `REJECTED` e `MERGED`.
- Estrutura para análise administrativa e vinculação a categorias existentes.
- Regra de que a ausência de categoria não impede o cadastro profissional.- Suporte à porta dinâmica de hospedagem com prioridade em `PORT`.
- Escuta explícita em `0.0.0.0` no servidor da API.
- Novo script `prisma:migrate:deploy` para implantações.
- Validação obrigatória de `DATABASE_URL` no ambiente.
- Consolidação do `apps/api/package.json` em um único `devDependencies`.## Autenticação e autorização

- Cadastro seguro de clientes e profissionais.
- Login com hash de senha Argon2id.
- Emissão de access token e refresh token.
- Criação de sessões autenticadas no PostgreSQL.
- Rotação segura de refresh tokens.
- Prevenção de reutilização de refresh tokens antigos.
- Logout com revogação da sessão.
- Validação de access token e sessão.
- Criação da rota protegida `GET /api/v1/users/me`.
- Autorização por papéis com `@Roles` e `RolesGuard`.
- Resposta `INSUFFICIENT_PERMISSIONS` para acessos não autorizados.

## Categorias

- Criação do modelo de categorias de serviços.
- Criação do fluxo de solicitações de novas categorias.
- Inclusão dos estados `PENDING`, `APPROVED`, `REJECTED` e `MERGED`.
- Estrutura para revisão por administradores ou moderadores.
- Possibilidade de vincular solicitações a categorias existentes.
- Regra de que a ausência de categoria não impede o cadastro profissional.

## Categorias de serviços

- Criação do módulo de categorias.
- Criação da rota pública `GET /api/v1/categories`.
- Listagem exclusiva de categorias ativas.
- Ordenação por ordem de exibição e nome.
- Retorno de dados públicos por DTO.
- Testes automatizados do service e controller.

## Carga inicial de categorias

- Criação de seed idempotente para categorias oficiais.
- Inclusão de oito categorias iniciais de serviços.
- Atualização de registros existentes por `slug`.
- Prevenção de categorias duplicadas em execuções repetidas.
- Validação da carga pela rota pública `GET /api/v1/categories`.

## 0.1.1 — Pré-lançamento (2026-08-05)
- Modelagem Prisma `LaunchInterest` para pré-cadastro de interesse no lançamento (sem criação de conta).
- Implementação da API pública `POST /api/v1/launch-interests` para registrar interesse no lançamento com normalização de e-mail, consentimento de privacidade e operação idempotente por e-mail normalizado.
- Adição de formulário de interesse no lançamento na página inicial com validação, envio seguro e mensagem de sucesso amigável.

## 2026-08-08

### Cadastro de cliente
- Conexão do formulário de cadastro de cliente à API real `POST /api/v1/auth/register`.
- Alinhamento das regras de senha com o backend: mínimo de 12 caracteres, máximo de 128, ao menos uma letra e um número.
- Introdução do versionamento inicial de Termos de Uso e Política de Privacidade com versão `1.0` para o formulário.

### Administração
- Criação da primeira etapa administrativa do painel de pré-cadastros com `GET /api/v1/launch-interests`.
- Proteção por `AccessTokenGuard` e `RolesGuard`, com `@Roles(Role.ADMIN)`.
- Consulta paginada com `page`, `pageSize`, total e `createdAt` em ordem decrescente.
- Exclusão de colunas sensíveis (`emailNormalized` e `phoneNormalized`) da resposta de consulta.

## 2026-08-07

### Produção e infraestrutura

- Publicado o backend NestJS da Soravi no Render.
- Criado PostgreSQL gerenciado de produção no Render.
- Configurada a API e o banco na região Virginia (US East).
- Configuradas variáveis de ambiente de produção para:
  - `NODE_ENV`;
  - `DATABASE_URL`;
  - `CORS_ORIGIN`;
  - `JWT_ACCESS_SECRET`;
  - `JWT_ACCESS_EXPIRES_IN_SECONDS`;
  - `JWT_REFRESH_EXPIRES_IN_DAYS`.
- Configurado health check da API em `/api/v1/health`.
- Configurado pre-deploy com `prisma migrate deploy`.
- Corrigido o script de inicialização da API para usar `dist/src/main.js`.
- Validado o build da API em ambiente de produção.
- Aplicadas com sucesso as migrations do PostgreSQL de produção.
- Conectado o frontend publicado na Vercel à API pública no Render.
- Validado o envio do formulário “Acompanhe o lançamento” em produção.
- Confirmada a persistência dos dados na tabela `launch_interests`.
- Validado o fluxo completo:
  - Vercel;
  - API NestJS no Render;
  - PostgreSQL no Render.

### Analytics e privacidade

- Publicado o banner de consentimento de cookies.
- Implementado Google Analytics 4 condicionado ao consentimento do usuário.
- Analytics permanece bloqueado antes da aceitação.
- Implementada revogação do consentimento com remoção dos cookies `_ga`.
- Configurada a variável `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` na Vercel.
- Validado o carregamento da tag GA4 em produção somente após o aceite.