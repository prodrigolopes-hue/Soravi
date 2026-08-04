# 02 - Regras de Negócio

# Objetivo

Este documento define as regras oficiais de funcionamento da plataforma
Soravi.

------------------------------------------------------------------------

# Perfis de Usuário

## Cliente

Pode:

-   criar conta;
-   editar perfil;
-   criar solicitações;
-   receber propostas;
-   conversar com profissionais;
-   contratar;
-   avaliar serviços.

## Profissional

Pode:

-   criar conta profissional;
-   informar categorias atendidas;
-   definir área de atuação;
-   enviar propostas;
-   conversar com clientes;
-   receber avaliações.

## Administrador

Pode:

-   moderar usuários;
-   remover conteúdos inadequados;
-   bloquear contas;
-   gerenciar categorias;
-   visualizar indicadores.

------------------------------------------------------------------------

# Solicitações

Cada solicitação deve conter:

-   título;
-   descrição;
-   categoria;
-   localização;
-   fotos (opcional);
-   data de criação;
-   status.

Status possíveis:

-   Aberta
-   Recebendo propostas
-   Em negociação
-   Contratada
-   Concluída
-   Cancelada

------------------------------------------------------------------------

# Propostas

Cada proposta deve conter:

-   profissional;
-   valor;
-   prazo estimado;
-   mensagem;
-   data de envio.

Um profissional pode enviar apenas uma proposta por solicitação, podendo
editá-la enquanto a solicitação estiver aberta.

------------------------------------------------------------------------

# Contratação

O cliente escolhe uma proposta.

Após a confirmação:

-   a solicitação é encerrada para novos interessados;
-   inicia-se a conversa entre cliente e profissional.

------------------------------------------------------------------------

# Avaliações

Somente clientes que concluíram um serviço podem avaliar.

A avaliação deve possuir:

-   nota de 1 a 5;
-   comentário opcional.

------------------------------------------------------------------------

# Chat

O chat somente é liberado após a contratação.

Todas as mensagens ficam registradas para fins de segurança e suporte.

------------------------------------------------------------------------

# Moderação

A plataforma poderá bloquear usuários que:

-   publiquem conteúdo inadequado;
-   pratiquem fraude;
-   utilizem linguagem ofensiva;
-   violem os termos de uso.

------------------------------------------------------------------------

# Segurança

-   Senhas armazenadas com hash.
-   Autenticação via JWT.
-   Validação de entrada em todas as APIs.
-   Proteção contra acessos não autorizados.

------------------------------------------------------------------------

# Princípio Geral

Sempre priorizar confiança, simplicidade e segurança em qualquer decisão
de produto.

## Autenticação e sessões

- o cadastro público permite apenas os papéis `CUSTOMER` e `PROFESSIONAL`;
- os papéis `MODERATOR` e `ADMIN` não podem ser escolhidos no cadastro público;
- o e-mail deve ser normalizado antes de consultas e validações de duplicidade;
- o telefone, quando informado, deve ser normalizado antes de ser armazenado;
- a senha deve ser armazenada somente como hash seguro;
- usuários com status `PENDING` ou `ACTIVE` podem realizar login;
- usuários com status `SUSPENDED`, `BLOCKED` ou `DEACTIVATED` não podem realizar login;
- o login gera um access token e um refresh token;
- o refresh token é armazenado apenas como hash;
- cada login cria uma sessão autenticada;
- o refresh token deve ser rotacionado após cada renovação;
- um refresh token antigo não pode ser reutilizado;
- o logout revoga a sessão;
- sessões expiradas ou revogadas não podem autenticar requisições;
- o access token deve estar vinculado a uma sessão válida;
- dados sensíveis, como senha e hashes de tokens, nunca devem ser retornados pela API.

## Autorização por papéis

- rotas protegidas exigem um access token válido;
- rotas específicas podem exigir um ou mais papéis;
- o usuário precisa possuir pelo menos um dos papéis permitidos;
- usuários autenticados sem o papel necessário recebem `INSUFFICIENT_PERMISSIONS`;
- os papéis usados na autorização devem ser carregados da sessão e do banco, evitando confiar apenas no conteúdo antigo do JWT;
- clientes, profissionais, moderadores e administradores possuem permissões diferentes;
- somente administradores ou moderadores autorizados poderão analisar solicitações de novas categorias.

## Categorias de serviços

- categorias representam tipos oficiais de serviços disponíveis na Soravi;
- cada categoria possui nome, slug, descrição opcional, ícone opcional, status e ordem de exibição;
- o slug deve ser único;
- somente categorias ativas aparecem em listagens públicas;
- categorias podem ser desativadas sem exclusão definitiva;
- a ordem de exibição é controlada por `displayOrder`;
- a criação, edição, ativação e desativação de categorias serão restritas à administração.

## Categorias solicitadas por profissionais

- a ausência de uma categoria não pode impedir o cadastro profissional;
- o profissional poderá solicitar a inclusão de uma nova categoria;
- a solicitação ficará pendente de análise;
- categorias solicitadas não aparecem automaticamente na busca pública;
- administradores ou moderadores poderão aprovar, rejeitar ou vincular a solicitação a uma categoria existente;
- o resultado da análise poderá ser `APPROVED`, `REJECTED` ou `MERGED`;
- solicitações repetidas podem ser mantidas como sinal de demanda;
- uma solicitação marcada como `MERGED` deverá apontar para a categoria oficial correspondente;
- o profissional deverá ser notificado futuramente sobre o resultado da análise.