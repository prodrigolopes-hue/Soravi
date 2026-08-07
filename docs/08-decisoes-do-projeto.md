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