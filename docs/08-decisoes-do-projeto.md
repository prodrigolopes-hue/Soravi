# 08 - Decisões do Projeto

# Objetivo

## Decisões operacionais atuais

Solicitações são revisadas antes da publicação; não se persistem rascunhos no fluxo atual. A dependência operacional da janela de dez minutos foi removida e oportunidades são despachadas imediatamente após a publicação. Início e conclusão de contrato pertencem às telas de oportunidade e solicitação, respectivamente; conversa é somente status e comunicação. Staging usa API em subdomínio próprio e permanece separado de Production. O MVP mantém monólito modular, sem pagamentos internos e sem microserviços prematuros.

Registrar todas as decisões estratégicas e técnicas da Soravi para
manter consistência ao longo do desenvolvimento.

------------------------------------------------------------------------

# Decisões Fundamentais

## Nome

Nome oficial:

Soravi

Motivo:

Nome curto, memorável, disponível para uso e alinhado à proposta da
plataforma.

------------------------------------------------------------------------

## Posicionamento

A Soravi não será um simples site de classificados.

Será uma plataforma que conecta pessoas a profissionais e acompanha toda
a jornada de contratação.

------------------------------------------------------------------------

## Público-alvo

-   Clientes que precisam contratar serviços.
-   Profissionais autônomos.
-   Pequenas e médias empresas prestadoras de serviços.

------------------------------------------------------------------------

## Arquitetura

Escolha:

Monólito modular.

Motivo:

Maior velocidade de desenvolvimento do MVP e facilidade de manutenção.

------------------------------------------------------------------------

## Stack Oficial

Frontend: - Next.js - React - TypeScript - Tailwind CSS

Backend: - NestJS - Prisma - PostgreSQL - Redis

------------------------------------------------------------------------

## Banco de Dados

Escolha:

PostgreSQL

Motivo:

Robusto, escalável e totalmente compatível com Prisma.

------------------------------------------------------------------------

## Versionamento

Git + GitHub

Fluxo:

main develop feature/\*

------------------------------------------------------------------------

## Estratégia de Desenvolvimento

Cada funcionalidade deverá ser desenvolvida em pequenos commits.

Cada entrega deverá conter:

-   código;
-   documentação;
-   testes;
-   commit.

------------------------------------------------------------------------

## Princípios

Toda decisão futura deverá respeitar:

-   simplicidade;
-   segurança;
-   escalabilidade;
-   excelente experiência do usuário.

------------------------------------------------------------------------

## Estratégia de crescimento orgânico e Hub de Problemas

### Decisão (2026-08-06)

A Soravi incorporará uma estratégia de crescimento orgânico e descoberta por problemas como parte da evolução do produto, sem substituir o escopo principal do MVP.

### Motivação

-   a jornada principal deve começar pela pergunta “Como podemos ajudar você hoje?”;
-   o usuário poderá chegar pela categoria, pelo profissional ou pelo problema;
-   o Hub de Problemas será uma capacidade central futura, integrada à jornada de descoberta e contratação;
-   o crescimento deverá ocorrer com qualidade editorial, SEO técnico e regras de publicação claras.

### Consequências

-   a plataforma deverá evoluir para páginas de categoria, problema, localização e profissional;
-   URLs públicas usarão slugs amigáveis e nunca exporão IDs internos;
-   a publicação futura deverá seguir critérios mínimos de qualidade e não depender de geração manual massiva de páginas;
-   páginas só serão publicadas quando houver entidade válida, categoria ativa, conteúdo exclusivo, metadata completa, canonical definido, CTA funcional, ausência de duplicidade relevante, revisão editorial e algum sinal real de oferta, cobertura ou informação local;
-   a estratégia será tratada como uma expansão do produto, e não como uma substituição do MVP.

------------------------------------------------------------------------

# Registro de Mudanças

Toda alteração importante deverá ser adicionada neste documento com:

-   Data
-   Decisão
-   Motivo
-   Impacto

## Google Analytics 4 com consentimento explícito e page view manual

### Decisão (2026-10-11)

A Soravi utiliza a tag GA4 `G-8V8DGFH741` somente após consentimento explícito. O padrão é `analytics_storage: denied`; o aceite atualiza exclusivamente esse armazenamento para `granted`, mantendo os consentimentos publicitários negados. A medição automática de page views permanece desativada no painel GA4, e a aplicação envia `page_view` manualmente.

### Motivação

O commit `74286a5`, publicado em produção, corrigiu o stub do `gtag` para usar `dataLayer.push(arguments)`, conforme o padrão oficial. A correção restaurou a transmissão técnica validada por requisições `collect` HTTP 204 no Chrome e no Edge, sem ampliar a coleta antes do consentimento.

### Consequências

- `/admin` e suas subrotas permanecem fora do rastreamento;
- URL, título e referrer são sanitizados, e somente `utm_source`, `utm_medium` e `utm_campaign` são mantidas na entrada;
- PostgreSQL continua sendo a fonte oficial dos dados de negócio; GA4 não é fonte de verdade operacional;
- a validação de `page_view` e de ausência de duplicação em recarregamento controlado não comprova conversão ou desempenho de negócio;
- a instrumentação e o consentimento devem ser monitorados periodicamente. Os próximos eventos planejados são `sign_up`, `service_request_published` e `proposal_submitted`.

## Monólito modular para o backend

### Decisão

O backend continuará como monólito modular em NestJS.

### Motivação

- reduzir complexidade operacional;
- permitir desenvolvimento incremental;
- evitar microsserviços prematuros;
- manter as regras de negócio centralizadas;
- facilitar testes e evolução do MVP.

## Autenticação com JWT e sessões persistidas

### Decisão

A Soravi utiliza access token JWT de curta duração e refresh token associado a uma sessão persistida no PostgreSQL.

### Motivação

- permitir autenticação stateless nas requisições;
- permitir revogação de sessões;
- permitir logout real;
- impedir reutilização de refresh tokens antigos;
- facilitar o controle futuro de dispositivos e sessões.

### Consequências

- o refresh token é armazenado somente como hash;
- cada renovação rotaciona o refresh token;
- a sessão pode ser revogada;
- o access token só é aceito quando sua sessão continua válida;
- Redis não é necessário para persistência principal das sessões nesta fase.

## Autorização por papéis

### Decisão

Rotas protegidas poderão declarar papéis permitidos por meio do decorator `@Roles`, com validação realizada pelo `RolesGuard`.

### Papéis atuais

- `CUSTOMER`;
- `PROFESSIONAL`;
- `MODERATOR`;
- `ADMIN`.

### Regra

O usuário precisa possuir pelo menos um dos papéis declarados na rota.

### Motivação

- separar permissões de clientes, profissionais e administração;
- evitar duplicação de regras nos controllers;
- criar uma base reutilizável para os módulos futuros.

## Solicitação de novas categorias por profissionais

### Decisão

Quando o profissional não encontrar uma categoria adequada, poderá solicitar sua inclusão sem interromper ou impedir o cadastro.

### Motivação

- evitar perda de profissionais interessados;
- reduzir abandono de cadastro;
- identificar novas áreas de atuação;
- descobrir categorias ainda não mapeadas;
- medir a demanda por novos tipos de serviço.

### Regra

A categoria solicitada não será publicada automaticamente.

Ela deverá passar por moderação e poderá ser:

- aprovada;
- rejeitada;
- vinculada a uma categoria existente.

### Consequência técnica

Foi criado o modelo `CategoryRequest`, separado de `Category`, com status de análise, profissional solicitante, responsável pela revisão e categoria resolvida opcional.

## Categorias sem hierarquia no primeiro incremento

### Decisão

O primeiro modelo de categorias não possui categorias-pai ou subcategorias.

### Motivação

- evitar complexidade prematura;
- validar primeiro a lista inicial de categorias;
- permitir evolução futura sem bloquear o MVP;
- manter a experiência simples no início.

A hierarquia poderá ser adicionada posteriormente se os dados reais demonstrarem necessidade.

## Lista oficial inicial de categorias do MVP

### Decisão (2026-08-12)

A lista oficial inicial de categorias do MVP da Soravi será:

1. Eletricista (`eletricista`)
2. Encanador (`encanador`)
3. Pintor (`pintor`)
4. Diarista (`diarista`)
5. Jardineiro (`jardineiro`)
6. Montador de móveis (`montador-de-moveis`)
7. Climatização e ar-condicionado (`climatizacao-e-ar-condicionado`)
8. Reparos e manutenção residencial (`reparos-e-manutencao-residencial`)

### Regras

- "Montador de móveis" é o nome oficial; "Montador" não é categoria oficial;
- "Reformas" não será criada como categoria separada neste primeiro MVP;
- PostgreSQL é a fonte oficial das categorias;
- listas hardcoded do frontend deverão ser substituídas gradualmente por `GET /api/v1/categories`;
- novas categorias poderão ser adicionadas futuramente por processo administrativo/moderação;
- a ordem inicial oficial é exatamente de 1 a 8 conforme a lista acima.

### Motivação

- reduzir divergência entre frontend, backend e banco;
- começar com conjunto pequeno e compreensível;
- evitar fragmentação de solicitações;
- permitir evolução posterior baseada em dados reais.

### Impacto

- a seed deverá refletir exatamente a lista aprovada;
- Home e cadastro profissional deverão migrar para a API oficial;
- o painel administrativo continuará como visão operacional das categorias;
- futuras `CategoryRequest` poderão alimentar a evolução da taxonomia.

## Relação explícita entre ProfessionalProfile e Category

### Decisão (2026-08-14)

Adotar relação many-to-many explícita entre `ProfessionalProfile` e `Category` por meio do model de junção `ProfessionalCategory`.

### Estrutura aprovada

- `ProfessionalCategory.id`;
- `ProfessionalCategory.professionalProfileId`;
- `ProfessionalCategory.categoryId`;
- `ProfessionalCategory.createdAt`;
- `UNIQUE (professionalProfileId, categoryId)`.

### Integridade referencial

- vínculo com `ProfessionalProfile` em `onDelete: Cascade`;
- vínculo com `Category` em `onDelete: Restrict`.

### Regras de negócio associadas

- no cadastro com `initialRole = PROFESSIONAL`, o backend deve aceitar `categorySlugs?: string[]`;
- para profissionais, `categorySlugs` é obrigatório na prática;
- mínimo de 1 e máximo de 3 categorias;
- sem slugs duplicados;
- somente categorias existentes e ativas (`isActive = true`);
- criação de `User`, `ProfessionalProfile` e vínculos `ProfessionalCategory` na mesma transação.

### Consequências

- PostgreSQL/API consolidam-se como fonte de verdade das categorias;
- frontend deve consumir `GET /api/v1/categories` para Home e cadastro profissional;
- listas hardcoded de categorias devem ser removidas de fluxos operacionais.

## Pré-cadastro de interesse no lançamento

### Decisão (2026-08-05)

O pré-cadastro realizado pelo formulário "Acompanhe o lançamento" será modelado como uma entidade separada (`LaunchInterest`) no banco de dados e não criará uma conta de `User`.

### Motivação

- separar registros de interesse de contas reais evita complexidade de segurança e validação neste fluxo;
- reduzir atrito no formulário de pré-lançamento (menos campos obrigatórios);
- permitir comunicações de marketing controladas com consentimento explícito.

### Consequências

- o registro não exige senha, CPF/CNPJ ou documentos;
- o telefone será opcional;
- o e-mail será normalizado e único entre registros de interesse;
- confirmação de e-mail e envio de mensagens serão implementados em entregas futuras;
- a modelagem será implementada no Prisma como `LaunchInterest` com índices para consultas por audiência, cidade/estado, fonte e status de confirmação/unsubscribe.

## Curadoria Inicial de Profissionais no piloto

### Decisão (2026-08-10)

Adotar, durante o piloto da Soravi, uma Curadoria Inicial de Profissionais assíncrona, progressiva e orientada por risco.

### Contexto

A entrevista manual obrigatória para todos os profissionais cria gargalo operacional e dificulta a escala.

A Soravi precisa manter confiança e segurança sem assumir que consegue certificar antecipadamente a qualidade técnica de cada prestador.

### Decisão operacional

A curadoria utilizará quatro camadas:

1. cadastro estruturado;
2. verificação básica;
3. evidências + questionário curto por categoria;
4. classificação operacional de risco.

Após essas camadas, o profissional poderá ser:

- aprovado;
- colocado como pendente;
- encaminhado para análise manual adicional;
- não aprovado naquele momento.

## Sugestão pública de categoria no pré-cadastro profissional

### Decisão (2026-08-14)

A Soravi deve captar sugestão de categoria já no cadastro profissional, antes de autenticação, por meio de uma entidade pública separada (`PublicCategorySuggestion`).

### Motivação

- reduzir abandono no cadastro profissional quando a categoria desejada não está disponível;
- coletar sinal real de demanda sem exigir conta criada;
- preservar separação semântica entre interesse comercial e demanda de taxonomia;
- evitar upsert por e-mail em `LaunchInterest` para não sobrescrever dados de finalidade diferente.

### Alternativas descartadas

- reutilizar `LaunchInterest`: descartado por incompatibilidade semântica e risco de sobrescrita por upsert;
- abrir `CategoryRequest` para usuários anônimos: descartado para preservar segurança e integridade do domínio autenticado.

### Consequências

- fluxo público de sugestão separado de `LaunchInterest` e de `CategoryRequest`;
- sugestão pública não cria conta profissional;
- sugestão pública não cria `Category` automaticamente;
- moderação administrativa restrita a `ADMIN`, com histórico de revisão preservado.

### Contato humano

Não será obrigatório para todos.

Será utilizado quando houver:

- inconsistências;
- ausência de evidências suficientes;
- sinais de risco;
- necessidade justificada pela análise.

### Classificação de risco

As classificações baixo/moderado/alto são conceitos operacionais do piloto.

Não constituem algoritmo, score automático ou decisão automatizada.

Qualquer automação futura deverá ser objeto de nova decisão técnica e de negócio.

### Identidade

Preferir o conceito público "Identidade verificada".

Não utilizar a expressão de forma que implique certificação de competência, qualidade ou garantia do serviço.

### CPF/CNPJ

Substituída pela decisão de evolução de contas de 2026-10-17, registrada ao
fim deste documento. O cadastro de pessoa jurídica inclui CNPJ e responsável
identificado por CPF; a representação empresarial detalhada permanece pendente.

### Não aprovação

Significa ausência de liberação naquele momento e poderá admitir reavaliação quando aplicável.

### Suspensão

Suspensões preventivas devem registrar motivo, data, responsável e permitir revisão administrativa.

### Motivação

- reduzir fraude;
- aumentar confiança;
- evitar entrevistas obrigatórias em escala;
- concentrar trabalho humano em exceções;
- permitir reputação progressiva baseada em serviços reais.

### Limitações

A curadoria:

- não certifica competência técnica;
- não garante a qualidade do serviço;
- não substitui responsabilidade do profissional;
- não inclui verificação de antecedentes;
- não elimina riscos;
- não cria garantia Soravi.

### Impacto

Profissionais com informações coerentes e baixo risco poderão ser aprovados sem contato humano direto.

Casos moderados ou altos terão revisão proporcional ao risco.

Nenhuma funcionalidade deve ser criada nesta decisão.

## Descoberta direta e solicitação nas páginas de categoria

### Decisão (2026-09-29)

A página de categoria da Soravi combinará descoberta direta de profissionais com criação de solicitação, evitando posicionamento como simples classificados.

### Diretrizes

- a rota conceitual planejada para categoria é `/servicos/[categorySlug]`;
- a experiência deve permitir tanto escolher um profissional e, no futuro, acessar seu perfil público ou solicitar seu serviço, quanto descrever a necessidade para abrir uma solicitação e receber propostas;
- o perfil público profissional é uma capacidade futura; sua rota final permanece a definir;
- filtros por localização/região, disponibilidade, avaliação, especialidades/subcategorias e verificação permanecem planejados, sem API ou interface implementada por esta decisão;
- a futura exibição pública deverá exigir perfil ativo, `verificationStatus = APPROVED`, disponibilidade e categoria compatível. Localização ou área de atendimento só entra nessa regra quando houver modelagem e regra correspondente.

### Consequências

Home, categoria, perfil público e filtros deverão evoluir como superfícies de descoberta e contratação complementares ao fluxo de solicitações e propostas. Esta decisão não cria rota, API, filtro, perfil público, migration ou alteração de código.

## Histórico append-only e reenvio da verificação profissional

### Decisão (2026-09-30)

As decisões administrativas de verificação serão registradas em
`ProfessionalVerificationReview` como eventos append-only. O
`ProfessionalProfile` conservará somente o snapshot da decisão mais recente:
`verificationStatus`, `reviewedAt`, `reviewedByUserId` e `reviewNotes`.

O profissional rejeitado pode corrigir o perfil e reenviá-lo explicitamente.
No reenvio `REJECTED -> PENDING`, os metadados de revisão do snapshot são
limpos, mas os eventos históricos não são alterados nem removidos.

### Consequências

- cada decisão vencedora `PENDING -> APPROVED|REJECTED` preserva autor, data,
  notas e estados de origem/destino;
- interfaces correntes consultam o snapshot para o estado operacional, sem
  tratar o histórico como estado mutável;
- `reviewNotes` é dado privado do profissional autenticado e não deve compor
  perfil ou descoberta pública;
- reenvio exige ação explícita após salvar as correções, evitando mudança de
  status automática pela simples edição do perfil.

Esta decisão está implementada, validada localmente e validada em staging. As
migrations `20260928000100_add_professional_profile_editable_fields` e
`20260929000100_create_professional_verification_reviews` foram aplicadas nesse
ambiente, cujo `prisma migrate status` confirmou atualizado com 29 migrations.
Esta documentação não afirma deploy, go-live ou validação em produção.

## Evolução de contas e CPF

### Decisões aprovadas (2026-10-17; extensão empresarial ainda não implementada)

Atualização de escopo: a proteção para categorias do perfil profissional
pessoal foi implementada nesta etapa. A extensão abaixo para empresas continua
pendente; esta entrega não modela empresas, CNPJ ou ativação de perfis.

- Uma pessoa utiliza uma única conta e pode possuir perfis de cliente e
  profissional, preservando seu histórico.
- Um cliente pode adicionar perfil profissional. O perfil continua sujeito à
  verificação profissional existente antes de enviar propostas.
- Um profissional pode ativar perfil cliente para contratar serviços.
- O bloqueio de solicitação considera a união das categorias profissionais
  pessoais do usuário e das empresas que ele representa ativamente,
  independentemente de atuar pessoalmente ou em nome de qualquer dessas
  empresas. Se a pessoa ou uma empresa representada oferece pintura, nenhum
  desses contextos pode solicitar pintura; outras categorias continuam
  permitidas. A regra é aplicada no backend antes da publicação e da liberação
  da contratação.
- A plataforma não deve distribuir oportunidade nem aceitar proposta de um
  profissional para solicitação criada pela sua própria conta.
- O cadastro de cliente ou profissional pode ser de pessoa física ou pessoa
  jurídica. Pessoa física informa nome completo e CPF; pessoa jurídica informa
  razão social, CNPJ e nome completo com CPF do responsável.
- PF/PJ e cliente/profissional são dimensões distintas: a primeira descreve a
  pessoa ou empresa; a segunda, os perfis de atuação. Esta decisão não define
  ainda a modelagem de empresas e representantes.
- CPF é dado privado e único da identidade pessoal, compartilhado entre seus
  perfis e não duplicado em contas pessoais independentes. Empresa e
  responsável são dados conceitualmente separados. Validar dígitos de CPF ou
  CNPJ não equivale a verificar identidade.
- Contas existentes não receberão CPF fictício.

### Proposta técnica (depende de definição operacional)

Modelar separadamente a identidade pessoal, que reúne nome completo e CPF, e a
empresa, que reúne razão social e CNPJ. A identidade pessoal é a referência
conceitual para os perfis e para a representação empresarial; isso não define
ainda tabelas, relações ou cardinalidades.

Armazenar o CPF da identidade pessoal de forma cifrada e seu índice HMAC
determinístico para unicidade, com chaves separadas. Não manter
simultaneamente uma cópia aberta dos mesmos dígitos. A constraint única deve
incidir sobre o índice HMAC da identidade pessoal; em conflito, a resposta
pública não pode confirmar se o CPF pertence a outra conta nem revelar seus
dados. Não impor unicidade de CPF diretamente na empresa: um responsável pode
representar mais de uma empresa.

### Incremento estrutural (2026-10-18)

Foi preparada a estrutura `PersonalIdentity`, opcional para `User`, com o
envelope cifrado completo do CPF, o HMAC determinístico único no banco e o
identificador da chave HMAC utilizada. O campo `User.name` continua sendo a
fonte atual do nome: não há duplicação de nome nem afirmação de conferência com
o CPF.

Este incremento não integra coleta ou persistência de CPF a cadastros,
serviços, endpoints ou frontend. Contas existentes seguem sem identidade
quando não houver cadastro explícito, e não serão criadas identidades vazias ou
com CPF fictício. Empresas e representantes permanecem incrementos futuros.

A unicidade de CPF é protegida pela constraint única sobre `cpf_hmac`. O
`hmacKeyId` registra a chave usada no cálculo, mas não implementa rotação nem
garante que versões de HMAC sejam unívocas. Enquanto não houver procedimento
seguro de rotação, não será permitido trocar a chave HMAC em banco que possua
identidades cadastradas. Correção, exclusão e retenção da identidade continuam
pendentes.

As ativações cliente → profissional e profissional → cliente devem ser
transacionais e idempotentes. A semântica para chamadas repetidas com dados
diferentes permanece pendente. Backend e frontend devem evoluir coordenadamente:
nenhum cadastro pode passar a exigir CPF antes de os formulários efetivamente o
enviarem. A ativação de perfil adicional só pode ser liberada depois de as
proteções backend contra solicitação na própria categoria e contra oportunidade
ou proposta na própria solicitação estarem implementadas e testadas.

### Requisitos técnicos da proposta

- Preservar compatibilidade com usuários legados sem CPF, sem criar dados
  fictícios.
- Derivar permissões empresariais da representação ativa e do perfil da
  empresa; não exigir perfil profissional pessoal do responsável.
- Garantir um único responsável ativo por empresa no MVP, inclusive sob
  concorrência.
- Implementar e testar as proteções backend antes de liberar os novos
  contextos de atuação.

### Pendências explícitas

- Política de adequação para contas existentes sem CPF.
- Cardinalidade entre empresa, responsáveis e vínculo com a conta pessoal,
  inclusive participação de outros representantes.
- Verificação do vínculo do responsável com a empresa.
- Migração de pessoa física para atuação empresarial.
- Aplicação das restrições por categoria à empresa e ao responsável.
- Privacidade e exposição dos dados empresariais.
- Correção de CPF, acesso interno, auditoria e retenção.
- Efeito de adicionar ou remover categorias sobre solicitações, oportunidades
  e propostas existentes.
- Política temporal para mudança de categorias e representações sobre
  solicitações e propostas já existentes.
- Comportamento de chamadas repetidas de ativação com dados diferentes.
