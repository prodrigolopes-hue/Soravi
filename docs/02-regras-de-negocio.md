# 02 - Regras de Negócio

# Objetivo

> Atualização: “Pedir mais detalhes” é um pedido privado e separado: o profissional elegível pergunta, o cliente responde uma única vez com fotos opcionais e o pedido é encerrado para consulta. Não é chat; outro esclarecimento exige outro pedido. Permanecem a exclusividade do pedido direcionado e as proteções de endereço.

O profissional consulta, na própria oportunidade, todos os pedidos que criou, com pergunta, status, resposta e fotos temporariamente autorizadas.

Na abertura de um novo pedido, o profissional pode combinar temas predefinidos (serviço, fotos, medidas/quantidade e prazo). “Outra dúvida” exige texto complementar; os temas são enviados juntos em um único pedido privado.

Avaliações estão implementadas nos dois sentidos após contrato `COMPLETED`: cliente avalia profissional e profissional vinculado avalia cliente, uma vez por contrato, com nota inteira de 1 a 5 e comentário opcional. As reputações correspondentes são atualizadas transacionalmente.

## Estado atual do MVP

Solicitações são preenchidas e revisadas no frontend antes do envio. A confirmação cria a solicitação em `OPEN`, preenche `publishedAt` e inicia o despacho imediato de oportunidades. Não há janela operacional de edição após a publicação.

O dispatcher seleciona solicitações `OPEN` publicadas, não excluídas e ainda não despachadas; mantém lock, idempotência e `skipDuplicates`, alcançando somente profissionais aprovados, disponíveis e compatíveis com a categoria. Avaliações e favoritos não estão implementados; avaliações dependem de contrato `COMPLETED` em trabalho futuro.

Solicitações podem ter um destinatário profissional opcional. Quando presente, a elegibilidade é revalidada na criação e no despacho: a conta deve estar `ACTIVE`, ter papel profissional, o perfil deve existir, estar aprovado e disponível, e atender à categoria ainda ativa. A oportunidade é exclusiva desse perfil; não há fallback para outros profissionais. A descoberta pública permite iniciar o pedido direcionado; login, cadastro de cliente e verificação de telefone preservam apenas o retorno interno seguro para esse fluxo. Se o destinatário ficar inelegível no despacho, o solicitante recebe o resultado de indisponibilidade, sem redistribuição automática.

Este documento define as regras oficiais de funcionamento da plataforma
Soravi.

------------------------------------------------------------------------

# Perfis de Usuário

## Conta e perfis

**Implementação atual:** uma conta profissional `PENDING` ou `ACTIVE`, não excluída e com perfil profissional não excluído, pode ativar seu
perfil cliente por `POST /api/v1/users/me/roles/customer`, sem perder
histórico. A operação é idempotente, preserva o perfil profissional e não
remove papéis existentes. Uma conta cliente `PENDING` ou `ACTIVE` também pode
ativar o perfil profissional com título, área, bio e categorias ativas, sem
alterar o perfil cliente ou aprovar a verificação profissional. Repetições
preservam o primeiro perfil profissional concluído; alterações posteriores
ocorrem na rota de edição do perfil. Ambas as modalidades continuam sujeitas à
verificação profissional existente antes do envio de propostas.

**Decisão aprovada, ainda não implementada:** o cadastro inicial de cliente é
simples e não exige CPF. O profissional também pode criar a conta e preencher o
perfil antes de concluir a verificação. Para liberar oportunidades e propostas,
ele deverá concluir a verificação definida abaixo. CPF continua dado privado,
único por pessoa e compartilhado entre seus perfis; não deve ser duplicado em
contas pessoais independentes. Os dados do responsável são conceitualmente
distintos dos dados da empresa.

A validação de dígitos de CPF ou CNPJ não equivale à autenticação ou
verificação de identidade. Contas existentes não receberão CPF fictício. A
cardinalidade entre pessoa, empresa, representantes e conta pessoal permanece
pendente na decisão de projeto.

PF/PJ descreve a natureza da pessoa ou empresa; cliente/profissional descreve
os perfis de atuação. São dimensões distintas, e esta regra não define ainda a
modelagem empresarial nem suas relações.

## Cliente

Pode:

-   criar conta;
-   editar perfil;
-   criar solicitações;
-   receber propostas;
-   conversar com profissionais;
-   contratar;
-   avaliar serviços.

**Implementação pessoal atual:** o backend bloqueia criação/publicação de
solicitação em categoria vinculada ao perfil profissional da mesma conta.
Também bloqueia adicionar tal categoria ao perfil se houver solicitação
própria em aberto nela. As duas gravações serializam pela linha da conta na
mesma transação.

Para esta regra, solicitação em aberto é `OPEN`, `RECEIVING_PROPOSALS` ou
`IN_NEGOTIATION`. `DRAFT` é legado e não é publicado; `HIRED`,
`IN_PROGRESS`, `COMPLETED` e `CANCELLED` não bloqueiam. Remover categoria não
altera solicitações, propostas ou contratos existentes, mas impede nova
proposta em oportunidade antiga porque a categoria é revalidada no envio.

**Extensão empresarial pendente:** incluir categorias de empresas representadas
ativamente na mesma proteção, sem implementar empresa, CPF/CNPJ ou ativação
de perfis nesta etapa.

## Profissional

Pode:

-   criar conta profissional;
-   consultar e editar o próprio perfil em `/profissional/perfil`;
-   informar categorias atendidas;
-   definir área de atuação;
-   enviar propostas após aprovação da verificação profissional;
-   conversar com clientes;
-   receber avaliações.

Um profissional não pode receber oportunidade nem enviar proposta para uma
solicitação criada pela sua própria conta, ainda que possua perfil cliente.
Essas proteções backend devem estar implementadas e testadas antes de liberar
a ativação de perfis adicionais.

### Verificação profissional

**Decisão aprovada, ainda não implementada integralmente:** a liberação para
receber oportunidades e enviar propostas requer nome completo e CPF, documento
com foto (CIN/RG ou CNH), telefone confirmado, e-mail confirmado e CEP de
referência, separado da região de atendimento. CEP não comprova residência;
CPF válido e documento enviado não equivalem a identidade verificada. CPF,
documentos e endereço residencial são privados.

Selfie, método de conferência de titularidade e critérios de aprovação ainda
dependem de definição. Pendências não bloqueiam login nem excluem histórico, e
a estratégia de adequação de profissionais existentes permanece pendente.
Empresas e CNPJ mantêm as decisões e pendências próprias.

**Decisão aprovada, ainda não implementada:** a foto de perfil deverá
corresponder ao profissional cuja identidade foi verificada, e o cliente deverá
conseguir identificar previamente quem realizará a visita. A conta profissional
individual é intransferível. Ajudantes e substitutos precisam ser identificados
previamente, com ciência do cliente; seus critérios de verificação e autorização
ainda serão definidos. Empresas deverão identificar as pessoas enviadas ao
atendimento, permanecendo pendentes a modelagem e as regras empresariais.

Documentos são privados, com acesso interno restrito. Deve existir canal para
denunciar divergência de identidade ou comportamento, sujeito a análise interna
e eventual suspensão. “Identidade verificada” descreve uma checagem concluída;
não garante conduta futura nem qualidade do serviço.

**Incremento implementado:** o profissional autenticado com papel `PROFESSIONAL`
pode enviar uma imagem JPEG ou PNG da CIN, RG ou CNH por
`POST /api/v1/users/me/professional-identity-verification/document`. O envio
exige CPF pessoal já registrado; nenhuma conta existente recebe CPF fictício.
O arquivo tem limite de 5 MiB, é validado pelo conteúdo (não apenas pelo MIME),
tem metadados removidos e é armazenado como objeto privado sem rota pública ou
URL retornada. A evidência cria ou completa uma tentativa privada em
`UNDER_REVIEW`; ela não aprova o perfil, não altera `ProfessionalVerificationStatus`
e não muda as regras atuais de oportunidades ou propostas. Somente a análise
interna futura poderá decidir a identidade. A fila/tela administrativa para essa
análise ainda não existe e está registrada no backlog. Candidatos de upload que
não forem associados mantêm tarefa privada de limpeza e reconciliação; a
migration correspondente precisa ser aplicada antes de habilitar este endpoint.

**Estado e reenvio de documento de identidade:** `GET /api/v1/users/me/professional-identity-verification` retorna o estado da tentativa mais recente, separado de `ProfessionalVerificationStatus`. Sem tentativa, o envio é permitido; em `UNDER_REVIEW`, a interface mostra “Documento enviado — aguardando análise” e o backend rejeita novo envio; em `CLOSED/CONFIRMED`, mostra “Identidade confirmada” e também bloqueia novo envio; em `CLOSED/NOT_CONFIRMED` ou `CLOSED/INCONCLUSIVE`, orienta a revisão e permite reenvio. A decisão e as evidências de cada tentativa permanecem append-only no histórico. O bloqueio é validado dentro da transação protegida pelo lock do perfil, inclusive para requisições concorrentes. Isso não altera a aprovação do perfil profissional, oportunidades ou propostas.

**Implementação atual:**

O `ProfessionalVerificationStatus` possui os estados `NOT_STARTED`, `PENDING`,
`APPROVED` e `REJECTED`. `NOT_STARTED` identifica o profissional que ainda não
enviou o perfil para análise; `PENDING`, o perfil em análise administrativa.

O profissional autenticado com papel `PROFESSIONAL` pode submeter o próprio
perfil pelo endpoint `POST /api/v1/users/me/professional-verification/submission`.
As transições permitidas são `NOT_STARTED -> PENDING` e, após uma rejeição,
`REJECTED -> PENDING`. A submissão exige `ProfessionalProfile` existente e não
excluído, `displayName` preenchido, telefone existente e verificado e pelo
menos uma `ProfessionalCategory` vinculada a uma categoria ativa. No reenvio
após `REJECTED`, também exige `professionalTitle` e `serviceArea` preenchidos e
`bio` com pelo menos 30 caracteres. A transição é protegida contra concorrência;
`PENDING` e `APPROVED` não podem ser submetidos novamente.

Em `/profissional/perfil`, o profissional vê o perfil em modo de visualização e
pode usar **Editar perfil**, salvar ou cancelar a edição de `displayName`,
`professionalTitle`, `serviceArea`, `bio`, de uma a três categorias e
`isAvailable`. Em `REJECTED`, ele vê “Perfil não aprovado”; salvar alterações
não reenvia automaticamente. Depois de salvar, a ação **Reenviar para análise**
fica disponível. Em `PENDING`, o painel informa “Perfil em análise”; em
`APPROVED`, mantém a indicação normal de aprovação. O estado permanece após
recarregar a sessão ou a página. `reviewNotes` pode ser exibido somente ao
próprio profissional autenticado e não é dado público.

## Administrador

Pode:

-   moderar usuários;
-   remover conteúdos inadequados;
-   bloquear contas;
-   gerenciar categorias;
-   visualizar indicadores.

### Revisão de verificação profissional

Somente `ADMIN` pode revisar um perfil pendente pelo endpoint
`PATCH /api/v1/users/admin/professionals/:userId/verification`. As únicas
transições permitidas são `PENDING -> APPROVED` e `PENDING -> REJECTED`.
`NOT_STARTED`, `APPROVED` e `REJECTED` não podem ser revisados neste fluxo.

A decisão pode registrar `reviewNotes` opcional, com espaços externos removidos
e até 1000 caracteres. Cada decisão vencedora cria um
`ProfessionalVerificationReview` append-only, preservando o evento
`PENDING -> APPROVED|REJECTED`. O `ProfessionalProfile` mantém somente o
snapshot da decisão mais recente (`verificationStatus`, `reviewedAt`,
`reviewedByUserId` e `reviewNotes`). No reenvio `REJECTED -> PENDING`, os três
campos de revisão do snapshot são zerados para `null`, sem apagar o histórico.
A operação é transacional e protegida contra concorrência. Ela não altera
`User.status`, sessões, regras de oportunidades nem redistribui oportunidades
retroativamente.

Em `/admin/profissionais`, somente itens `PENDING` exibem Aprovar e Rejeitar.
Após uma decisão, a linha é atualizada localmente e as ações deixam de aparecer.
O histórico de decisões é preservado; documentos comprobatórios e notificações
da decisão não fazem parte deste MVP.

### Estado de implementação e ambientes

O perfil editável, o histórico append-only e o reenvio após rejeição estão
**IMPLEMENTADOS, VALIDADOS LOCALMENTE E VALIDADOS EM STAGING**. Em staging,
foram confirmados os ciclos `NOT_STARTED -> PENDING -> APPROVED` e
`PENDING -> REJECTED -> editar -> salvar -> reenviar -> PENDING -> APPROVED`,
inclusive a persistência após F5 e a visibilidade privada do motivo de revisão.
Essa validação não afirma deploy ou go-live em produção.

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

Quando o solicitante também tiver perfil profissional, o backend deve bloquear
a criação antes de publicar ou distribuir a solicitação se sua categoria
estiver entre as categorias profissionais ativas daquele usuário.

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

O backend também nega propostas do profissional para solicitação da sua
própria conta, independentemente de oportunidades já existentes, e revalida
que a categoria da solicitação continua vinculada ao seu perfil no momento do
envio. A revalidação não desfaz propostas ou contratos anteriores.

------------------------------------------------------------------------

# Contratação

O cliente escolhe uma proposta.

### Política de visibilidade de propostas

- O cliente escolhe 3, 5 ou 10 propostas visíveis ao criar a solicitação; o padrão é 3.
- A solicitação aceita no máximo 12 propostas. As primeiras dentro do limite escolhido ficam visíveis e as demais permanecem em reserva, por ordem de chegada, sem expor sua posição.
- Rejeitar uma proposta não promove reserva automaticamente. O cliente pode pedir uma nova proposta, ou aumentar o limite de 3 para 5 e de 5 para 10, para promover reservas na ordem recebida.
- A retirada de uma proposta visível pelo profissional promove automaticamente a próxima reserva. O aceite encerra o fluxo e rejeita as demais propostas ativas.

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

No fluxo atual, o chat somente é liberado após a contratação.

Todas as mensagens ficam registradas para fins de segurança e suporte.

------------------------------------------------------------------------

## Contato pré-proposta e visita técnica

“Pedir mais detalhes” está implementado como pedido privado, independente e vinculado à oportunidade e à solicitação. O profissional elegível cria uma pergunta; o cliente participante responde uma única vez, opcionalmente com até cinco fotos, e o pedido é encerrado para consulta. Não há continuação de mensagens nesse pedido: nova dúvida exige novo pedido.

O profissional consulta, no detalhe da própria oportunidade, os pedidos que criou, com pergunta, status, resposta e fotos autorizadas. O cliente consulta e responde seus pedidos no detalhe da própria solicitação. A interface não representa esse fluxo como chat; o chat contratual continua separado e só é liberado após a contratação.

Outros profissionais não podem acessar pedidos alheios. Em solicitações direcionadas, somente o destinatário exclusivo pode criar e consultar pedidos. Endereço completo, CEP, telefone, e-mail, chaves de storage e outros dados privados não são devolvidos por esse fluxo; as fotos são entregues apenas aos participantes autorizados por URL temporária.

Para cada foto de resposta, o backend cria antes do upload um candidato persistente com chave própria. A associação bloqueia esse candidato e só o aceita enquanto ainda não foi reivindicado pela manutenção; a associação da foto e a remoção do candidato ocorrem na mesma transação. Um processador limitado usa `FOR UPDATE SKIP LOCKED`, lease e novas tentativas para limpar objetos órfãos, inclusive uploads que terminem após uma tentativa de exclusão. Uma foto já referenciada é protegida contra exclusão.

“Solicitar visita técnica” será um incremento posterior: o profissional deverá informar o motivo, uma sugestão de data e horário e se a visita é gratuita ou paga; quando paga, o valor deverá ser explícito. A visita exigirá aceite do cliente e não implicará contratação do serviço principal.

O endereço completo não será liberado automaticamente ao iniciar o contato. A regra de liberação de endereço para visita técnica deverá ser definida antes da implementação.

O histórico de decisão que previa avaliar o reaproveitamento do chat foi substituído: pedidos de esclarecimento não reutilizam nem alteram as permissões do chat de contratos.

------------------------------------------------------------------------

# Moderação

A plataforma poderá bloquear usuários que:

-   publiquem conteúdo inadequado;
-   pratiquem fraude;
-   utilizem linguagem ofensiva;
-   violem os termos de uso.

## Bloqueio e reativação administrativa no MVP

- somente `ADMIN` pode usar o fluxo, exclusivamente sobre contas `CUSTOMER` e `PROFESSIONAL`;
- o administrador não pode alterar a própria conta nem qualquer outra conta com papel `ADMIN` por esse endpoint;
- somente `ACTIVE` e `BLOCKED` participam do fluxo; `PENDING`, `SUSPENDED`, `DEACTIVATED` e contas soft-deleted não podem ser alteradas;
- `ACTIVE -> BLOCKED` altera o status e revoga todas as sessões ainda ativas;
- `BLOCKED -> BLOCKED` é idempotente e continua revogando sessões residuais;
- `BLOCKED -> ACTIVE` não restaura sessões anteriores, portanto o usuário precisa entrar novamente;
- `ACTIVE -> ACTIVE` é no-op;
- bloquear e reativar exigem confirmação inline no painel. Após sucesso, somente o status do item afetado é atualizado localmente, sem reload ou novo fetch obrigatório;
- erros públicos são apresentados por mensagens sanitizadas derivadas do código; mensagens arbitrárias do backend nunca são exibidas.

------------------------------------------------------------------------

# Favoritos

- Somente clientes autenticados podem criar, remover e listar seus favoritos.
- Um favorito é único por par cliente-profissional; tentativa repetida é recusada pelo backend.
- Não é possível favoritar perfil profissional inexistente ou excluído.
- A remoção é idempotente e não altera propostas, contratos ou avaliações.

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

## Verificação e alteração de telefone

- `CUSTOMER` e `PROFESSIONAL` precisam de telefone verificado para ações sensíveis protegidas explicitamente pelo backend;
- leituras privadas autenticadas permanecem disponíveis sem verificação de telefone;
- `ADMIN` está temporariamente fora dessa exigência para evitar lockout operacional;
- a troca do próprio telefone exige a senha atual;
- informar o mesmo número normalizado é um no-op seguro;
- uma mudança real invalida a verificação e exige novo OTP, mas não solicita OTP automaticamente;
- a sessão atual é preservada e as demais sessões ativas são revogadas.

## Recuperação de senha

- a solicitação pública nunca revela se o e-mail existe ou se a conta é elegível;
- somente contas `PENDING` e `ACTIVE`, não excluídas, podem receber reset;
- o token expira em 30 minutos, é de uso único e nunca é persistido em claro;
- a nova senha deve ter de 12 a 128 caracteres, sem exigência obrigatória de letra, número, maiúscula, minúscula ou símbolo;
- qualquer composição entre 12 e 128 caracteres é permitida, exceto senhas comuns bloqueadas pelo backend;
- a senha nunca deve ser trimada, normalizada ou truncada antes de hashing ou verificação;
- a redefinição válida revoga todas as sessões da conta cuja senha foi redefinida e invalida os demais tokens pendentes;
- após uma redefinição válida, o navegador encerra somente sua sessão local atual (mesmo se ela for de outra conta), informa que a senha foi alterada e oferece acesso à tela de login; o reset não autentica o usuário automaticamente;
- links inválidos, expirados ou outros erros não alteram a sessão atual do navegador;
- uma troca administrativa de senha também invalida tokens de reset pendentes.

## Autenticação e sessões

- o cadastro público permite apenas os papéis `CUSTOMER` e `PROFESSIONAL`;
- os papéis `MODERATOR` e `ADMIN` não podem ser escolhidos no cadastro público;
- o e-mail deve ser normalizado antes de consultas e validações de duplicidade;
- o telefone, quando informado, deve ser normalizado antes de ser armazenado;
- a senha deve ser armazenada somente como hash Argon2id;
- o backend é a autoridade da política de senha e bloqueia senhas comuns; o frontend valida apenas 12 a 128 caracteres e trata `PASSWORD_TOO_COMMON`;
- usuários autenticados podem alterar a própria senha em `/api/v1/users/me/password`, informando senha atual e nova senha;
- a alteração de senha usa `userId` e `sessionId` do contexto autenticado, nunca do cliente, não exige telefone verificado e é permitida para `CUSTOMER`, `PROFESSIONAL` e `ADMIN`;
- a nova senha deve ser diferente da atual, seguir a política central 12 a 128 com bloqueio de senhas comuns e nunca ser trimada, normalizada ou truncada antes do hashing;
- a troca autenticada preserva a sessão atual, revoga as demais sessões ativas e invalida tokens pendentes de recuperação de senha;
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

## Descoberta e contratação por categoria (planejado)

As futuras páginas públicas de categoria deverão oferecer tanto a escolha de um profissional quanto a descrição da necessidade para abertura de solicitação. A listagem não substituirá o fluxo de solicitações e propostas.

Quando a exibição pública de profissionais for implementada, ela deverá considerar perfil profissional ativo, `verificationStatus = APPROVED`, disponibilidade e categoria compatível. Localização ou área de atendimento só deverá compor essa elegibilidade quando a respectiva regra estiver implementada.

Os cards futuros poderão exibir avatar, nome público, título, área de atendimento, selo de verificação, reputação, quantidade de avaliações, descrição curta, especialidades/categorias e as ações “Ver perfil” e “Solicitar serviço”. Esses dados e regras de apresentação não constituem API ou filtro já disponível.

Os filtros por localização/região, disponibilidade, avaliação, especialidades/subcategorias e verificação são evolução planejada. Nenhum deve ser apresentado como implementado antes de regras, dados e interfaces correspondentes.

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

Para pessoa física, CPF será privado e exigido somente no fluxo de verificação
profissional aprovado; não é obrigatório no cadastro inicial de cliente. Para
pessoa jurídica, CNPJ, razão social e os dados pessoais do responsável são
distintos. CPF não compõe perfil público nem é compartilhado como dado de
apresentação; sua validação estrutural não comprova identidade. A privacidade
dos dados empresariais e a representação da empresa permanecem pendentes.

Deve ser mantido o princípio de minimização de dados pessoais.

### Camada 2 - identidade e presença real

Devem ser considerados:

- nome;
- telefone confirmado;
- cidade/região;
- foto de perfil, quando aplicável;
- coerência das informações;
- resultado, método e responsável pela verificação de identidade, quando
  aplicável.

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
