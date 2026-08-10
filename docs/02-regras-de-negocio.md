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

## Pré-cadastro de interesse no lançamento

Regras específicas para o formulário "Acompanhe o lançamento":

- o pré-cadastro não cria uma conta de usuário no sistema;
- não solicitar senha, CPF, CNPJ ou outros documentos neste fluxo;
- o telefone é opcional e deve ser normalizado quando fornecido;
- `marketingConsentAt` é opcional e representa o consentimento para comunicações de marketing;
- o usuário pode cancelar comunicações a qualquer momento (campo `unsubscribedAt`);
- o e-mail deve ser normalizado antes de persistir e é único entre registros de interesse;
- a confirmação por e-mail (`emailConfirmedAt`) será implementada em uma entrega futura;
- este pré-cadastro faz parte do MVP de pré-lançamento e não gera sessão nem conta de usuário.

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

## Curadoria Inicial de Profissionais

### Objetivo

A curadoria inicial busca reduzir cadastros falsos, verificar a existência real do profissional, reunir evidências mínimas de atuação, identificar inconsistências e sinais relevantes de risco.

A Soravi não pretende certificar tecnicamente o profissional antes do primeiro serviço.

Pergunta central da curadoria:

"Existem evidências suficientes de que esta pessoa é real, exerce ou possui relação plausível com o serviço informado e não apresenta sinais relevantes de risco?"

### Identificação pública

Quando houver indicação pública da validação inicial, preferir "Identidade verificada".

Evitar "Profissional verificado".

Deixar explícito que identidade verificada não significa certificação de:

- competência técnica;
- qualidade do serviço;
- antecedentes;
- habilitações profissionais;
- garantia do trabalho.

### Estrutura da curadoria

A curadoria inicial possui quatro camadas:

1. Cadastro estruturado.
2. Verificação básica.
3. Evidências de atuação + questionário por categoria.
4. Classificação de risco.

Após as quatro camadas, o resultado ou encaminhamento poderá ser:

- aprovação;
- pendência;
- análise manual adicional;
- não aprovação.

Regra de modelagem: aprovação, pendência, análise manual adicional e não aprovação são resultados ou encaminhamentos, não uma quinta camada.

### Camada 1 - cadastro estruturado

Informações iniciais poderão incluir:

- nome completo;
- telefone;
- cidade;
- bairros/regiões atendidas;
- categoria profissional;
- serviços realizados;
- tempo de experiência declarado;
- forma geral de atendimento;
- disponibilidade aproximada.

CPF ou CNPJ não deve ser tratado como obrigatório no cadastro inicial para todos.

Regra: "CPF ou CNPJ poderá ser solicitado quando necessário para a etapa de verificação de identidade, conforme finalidade, proporcionalidade, categoria, risco e regras de privacidade aplicáveis."

Deve ser mantido o princípio de minimização de dados pessoais.

### Camada 2 - identidade e presença real

Devem ser considerados:

- nome;
- telefone confirmado;
- cidade/região;
- foto de perfil, quando aplicável;
- coerência das informações;
- CPF/CNPJ, quando necessário à verificação.

Evitar armazenamento de cópias completas de documentos sem necessidade.

Preferir o registro de:

- resultado;
- data;
- método utilizado;
- responsável ou sistema responsável.

### Camada 3 - evidências de atuação e questionário

Poderão ser usadas evidências como:

- fotos de trabalhos;
- antes/depois;
- portfólio;
- referências;
- depoimentos;
- perfis profissionais públicos;
- presença em outras plataformas.

Presença digital nunca será requisito obrigatório.

Instagram, site ou marketplace são evidências complementares, não condição obrigatória.

Questionário por categoria:

- deve ser curto e assíncrono, com aproximadamente 3 a 5 perguntas por categoria;
- busca verificar coerência;
- busca conhecer serviços realizados;
- busca identificar cadastro em categoria incompatível;
- busca conhecer limites de atuação;
- busca detectar respostas claramente inconsistentes.

O questionário não deve ser apresentado como prova, certificação ou avaliação técnica profissional.

### Camada 4 - classificação de risco

Classificações mantidas:

- baixo;
- moderado;
- alto.

Regra explícita: "A classificação de risco nesta fase é um instrumento operacional de apoio à curadoria. Não representa score automatizado, algoritmo de decisão ou sistema automático de aprovação/reprovação. Os critérios deverão ser amadurecidos e aprovados antes de qualquer automação futura."

Baixo risco:

- poderá seguir para aprovação sem contato humano obrigatório.

Moderado:

- revisão manual;
- solicitação de complemento;
- contato direto quando necessário.

Alto:

- análise humana obrigatória;
- poderá resultar em não aprovação, suspensão preventiva quando aplicável ou análise manual adicional.

Padronização terminológica: utilizar "análise adicional" ou "análise manual adicional".

### Contato humano

Todo profissional passará por curadoria inicial.

O contato direto será utilizado quando existirem inconsistências, ausência de evidências suficientes, sinais relevantes de risco ou necessidade justificada pela análise.

### Resultados

Aprovado: há elementos suficientes para liberação naquele momento.

Pendente: há informações ou evidências a complementar.

Não aprovado: há inconsistências ou riscos suficientes para impedir a liberação naquele momento.

O resultado não aprovado não representa necessariamente impedimento definitivo. Quando aplicável, o profissional poderá ser reavaliado após correção de pendências, apresentação de novas evidências ou revisão administrativa.

### Pós-aprovação

Deve ser mantido o princípio de curadoria progressiva.

A confiança deve crescer com:

- serviços concluídos;
- avaliações;
- comportamento;
- cancelamentos;
- reclamações;
- histórico consistente.

Após os primeiros serviços, poderá haver reavaliação.

### Reclamações e suspensão

Ocorrências graves poderão justificar suspensão preventiva.

Toda suspensão preventiva deverá possuir motivo registrado, data, responsável pela decisão e mecanismo de revisão administrativa. Suspensão preventiva não deve ser tratada automaticamente como decisão definitiva.

### LGPD e proporcionalidade

Na curadoria inicial, reforçar:

- minimização;
- finalidade;
- restrição de acesso;
- segurança;
- retenção proporcional;
- descarte futuro;
- transparência ao titular.

Verificações avançadas como antecedentes criminais, certificações extensas e verificações de alto custo não fazem parte automaticamente do piloto e dependerão de análise jurídica, proporcionalidade e decisão específica futura.
