# 07 - Backlog do Produto

# Objetivo

Organizar todas as funcionalidades da Soravi em uma lista priorizada
para orientar o desenvolvimento.

------------------------------------------------------------------------

# ÉPICO 1 - Autenticação

## História 1

Como usuário, quero criar uma conta.

Tarefas: - Tela de cadastro - Validação dos campos - Criptografia da
senha - Envio para API

## História 2

Como usuário, quero fazer login.

Tarefas: - Tela de login - JWT - Recuperação de senha - Manter sessão

------------------------------------------------------------------------

# ÉPICO 2 - Perfil

-   Editar perfil
-   Foto
-   Endereço
-   Categorias
-   Área de atuação

------------------------------------------------------------------------

# ÉPICO 3 - Solicitações

-   Criar solicitação
-   Editar
-   Excluir
-   Alterar status
-   Upload de imagens

------------------------------------------------------------------------

# ÉPICO 4 - Propostas

-   Enviar proposta
-   Editar proposta
-   Cancelar proposta
-   Selecionar profissional

------------------------------------------------------------------------

# ÉPICO 5 - Chat

-   Criar conversa
-   Enviar mensagens
-   Marcar como lida
-   Notificações

------------------------------------------------------------------------

# ÉPICO 6 - Avaliações

-   Avaliar profissional
-   Exibir nota média
-   Histórico

------------------------------------------------------------------------

# ÉPICO 7 - Administração

-   Dashboard
-   Gerenciar usuários
-   Gerenciar categorias
-   Moderar conteúdo

------------------------------------------------------------------------

# Prioridade Atual

Sprint 1

-   Landing Page
-   Cadastro
-   Login
-   Estrutura do banco
-   Autenticação
 -   Pré-cadastro: modelagem `LaunchInterest` (Prisma)

------------------------------------------------------------------------

# Critério de Conclusão

Cada tarefa somente será considerada concluída quando:

-   Código implementado;
-   Testes realizados;
-   Revisão concluída;
-   Commit efetuado;
-   Documentação atualizada.

## Autenticação e autorização

### Concluído

- [x] Cadastro de cliente.
- [x] Cadastro de profissional.
- [x] Login com e-mail e senha.
- [x] Hash de senha com Argon2id.
- [x] Emissão de access token JWT.
- [x] Emissão de refresh token.
- [x] Criação de sessão no PostgreSQL.
- [x] Rotação segura do refresh token.
- [x] Bloqueio de reutilização do refresh token antigo.
- [x] Logout com revogação de sessão.
- [x] Rota protegida `GET /api/v1/users/me`.
- [x] Validação do access token.
- [x] Validação da sessão no PostgreSQL.
- [x] Autorização por papéis.
- [x] Decorator `@Roles`.
- [x] `RolesGuard`.
- [x] Testes automatizados de autenticação e autorização.

### Pendente

- [ ] Recuperação de senha no backend.
- [ ] Confirmação de e-mail.
- [ ] Encerramento de todas as sessões.
- [ ] Listagem de sessões ativas.
- [ ] Integração da autenticação com o frontend.

## Categorias de serviços

### Concluído

- [x] Modelo `Category`.
- [x] Modelo `CategoryRequest`.
- [x] Enum `CategoryRequestStatus`.
- [x] Migration de categorias e solicitações.
- [x] Relação da solicitação com o perfil profissional.
- [x] Relação da análise com administrador ou moderador.
- [x] Possibilidade de vincular solicitação a categoria existente.

### Próximos itens

- [x] Criar módulo de categorias.
- [x] Criar listagem pública de categorias ativas.
- [x] Criar carga inicial de categorias.
- [ ] Criar solicitação de categoria pelo profissional.
- [ ] Detectar categorias e solicitações semelhantes.
- [ ] Criar painel administrativo de análise.
- [ ] Aprovar solicitação.
- [ ] Rejeitar solicitação.
- [ ] Vincular solicitação a uma categoria existente.
- [ ] Notificar profissional sobre o resultado.
- [ ] Associar categorias ao perfil profissional.