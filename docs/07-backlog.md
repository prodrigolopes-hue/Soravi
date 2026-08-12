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

### Concluído até agora

- [x] Primeira tela administrativa.
- [x] Listagem de interessados do lançamento.
- [x] Proteção visual por `ADMIN`.
- [x] Paginação básica.
- [x] Responsividade mobile e desktop.

### Pendente

- [ ] Dashboard administrativo completo.
- [ ] Gerenciamento de usuários.
- [ ] Gerenciamento de categorias.
- [ ] Moderação.
- [ ] Filtros.
- [ ] Busca.
- [ ] Exportação.
- [ ] Edição/exclusão.

------------------------------------------------------------------------

# Prioridade Atual

Sprint 1

-   Landing Page
-   Cadastro
-   Login
-   Estrutura do banco
-   Autenticação
-   Pré-cadastro: modelagem `LaunchInterest` (Prisma)
-   [x] API pública de registro de interesse no lançamento

------------------------------------------------------------------------

# Segmentação de backlog por maturidade

## MVP

Itens de fundação inicial:

-   metadata base;
-   sitemap;
-   robots;
-   home indexável;
-   slugs preparados;
-   estrutura inicial de categorias;
-   possibilidade futura de perfil público;
-   localização compatível com expansão;
-   CTA orientado por problema.

## Pós-MVP

-   páginas de categoria;
-   páginas de problema iniciais;
-   melhorias de SEO técnico;
-   dados estruturados básicos.

## Crescimento

-   Hub de Problemas completo;
-   páginas locais por cidade e bairro;
-   conteúdo educativo e blog técnico;
-   perfis públicos indexáveis;
-   expansão geográfica e editorial.

## Infraestrutura editorial

-   painel editorial;
-   revisão editorial;
-   governança de slugs e redirecionamentos;
-   Search Console e métricas de conteúdo;
-   automação editorial controlada.

Não incluir no MVP:

-   geração de milhares de páginas;
-   bairros em escala nacional;
-   blog completo;
-   automação editorial;
-   SEO programático em massa;
-   painel editorial completo.

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
- [x] Manutenção de sessão persistente com refresh seguro em cookie HttpOnly e access token em memória.
- [x] Rota protegida `GET /api/v1/users/me`.
- [x] Validação do access token.
- [x] Validação da sessão no PostgreSQL.
- [x] Autorização por papéis.
- [x] Decorator `@Roles`.
- [x] `RolesGuard`.
- [x] Testes automatizados de autenticação e autorização.
- [x] Integração da autenticação com o frontend.

### Pendente

- [ ] Recuperação de senha no backend.
- [ ] Confirmação de e-mail.
- [ ] Encerramento de todas as sessões.
- [ ] Listagem de sessões ativas.

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

## Verificação e curadoria de profissionais

### Épico

ÉPICO - Verificação e Curadoria de Profissionais.

### Objetivo

Fornecer mecanismos progressivos de confiança e segurança para profissionais, preservando escalabilidade operacional e minimização de dados.

### Itens futuros

- [ ] confirmação de telefone;
- [ ] verificação básica de identidade;
- [ ] solicitação de CPF/CNPJ somente quando necessária à verificação;
- [ ] registro do resultado da verificação sem armazenar documentos completos desnecessariamente;
- [ ] evidências profissionais;
- [ ] portfólio/fotos;
- [ ] questionário curto por categoria;
- [ ] checklist de curadoria;
- [ ] classificação operacional de risco;
- [ ] pendências;
- [ ] análise manual adicional;
- [ ] aprovação;
- [ ] não aprovação com possibilidade de reavaliação;
- [ ] suspensão preventiva;
- [ ] revisão administrativa de suspensão;
- [ ] histórico de análises;
- [ ] motivo das decisões;
- [ ] registro de ocorrências;
- [ ] reavaliação após primeiros serviços;
- [ ] painel administrativo de curadoria.

### Capacidade esperada

CAPACIDADE - Identidade verificada.

Critérios conceituais:

- refletir somente o que efetivamente foi verificado;
- não sugerir certificação técnica;
- registrar método/data da verificação;
- respeitar minimização de dados.

### Governança de risco

"A classificação de risco não deverá ser automatizada enquanto critérios, governança, revisão humana e impactos não forem definidos em decisão futura específica."

### Fora do escopo deste épico imediato

- antecedentes criminais automáticos;
- scoring automatizado;
- IA para aprovação;
- certificação técnica automática;
- verificações de alto custo;
- coleta documental massiva.

### Priorização

Este épico não altera a prioridade geral do MVP sem aprovação do fundador e permanece fora do MVP imediato.
