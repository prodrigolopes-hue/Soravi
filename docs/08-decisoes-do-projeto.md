# 08 - Decisões do Projeto

# Objetivo

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

Não coletar obrigatoriamente de todo profissional no primeiro cadastro.

Poderá ser solicitado quando necessário para verificação, respeitando finalidade, proporcionalidade e minimização de dados.

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