# Changelog

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