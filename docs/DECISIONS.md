# Decisões do Projeto Soravi

## 1. Objetivo

Este documento registra as decisões estratégicas, técnicas e arquiteturais oficiais da Soravi.

Seu objetivo é:

- preservar o contexto das decisões;
- evitar mudanças contraditórias;
- orientar o desenvolvimento;
- facilitar a entrada de novos desenvolvedores;
- registrar impactos e riscos;
- manter código, produto e documentação alinhados.

Toda decisão estrutural relevante deverá ser registrada neste documento antes ou durante sua implementação.

---

## 2. Formato das decisões

Cada decisão deverá conter:

```text
Identificador
Data
Status
Contexto
Decisão
Motivo
Impactos
Riscos
Consequências
```

### Status permitidos

```text
PROPOSED
ACCEPTED
SUPERSEDED
REJECTED
DEPRECATED
```

### Significados

#### PROPOSED

A decisão está em análise e ainda não foi aprovada.

#### ACCEPTED

A decisão foi aprovada e deve orientar o projeto.

#### SUPERSEDED

A decisão foi substituída por uma decisão mais recente.

#### REJECTED

A proposta foi analisada e rejeitada.

#### DEPRECATED

A decisão continua registrada, mas não deve mais ser utilizada.

---

## 3. Princípios gerais

Toda decisão da Soravi deverá respeitar:

1. Simplicidade.
2. Segurança.
3. Privacidade.
4. Clareza.
5. Experiência do usuário.
6. Desenvolvimento incremental.
7. Manutenção sustentável.
8. Escalabilidade orientada por necessidade.
9. Foco no MVP.
10. Registro das mudanças estruturais.

Tecnologias não deverão ser adicionadas apenas por tendência ou possibilidade futura.

---

# Registro de decisões

## DEC-001 — Nome oficial Soravi

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

O projeto precisava de uma identidade curta, memorável e adequada à proposta da plataforma.

### Decisão

O nome oficial do produto e da empresa será:

```text
Soravi
```

### Motivo

O nome é curto, possui identidade própria e está alinhado à proposta de conectar pessoas a soluções.

### Impactos

- nome utilizado no produto;
- domínio oficial;
- identidade visual;
- documentação;
- repositórios;
- comunicação institucional.

### Consequências

Mudanças futuras de nome exigirão revisão ampla de produto, comunicação e infraestrutura.

---

## DEC-002 — Posicionamento da plataforma

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

A Soravi não deve ser percebida apenas como um mural de anúncios ou classificados.

### Decisão

A Soravi será posicionada como uma plataforma que conecta pessoas a profissionais e acompanha a jornada de contratação.

A mensagem central será:

```text
A Soravi conecta pessoas a soluções.
```

A pergunta principal da experiência será:

```text
Como podemos ajudar você hoje?
```

### Motivo

O valor da plataforma está no fluxo completo:

1. identificação da necessidade;
2. criação da solicitação;
3. recebimento de propostas;
4. comparação;
5. contratação;
6. conversa;
7. conclusão;
8. avaliação.

### Impactos

- Home orientada à necessidade;
- navegação focada em serviços;
- solicitações como elemento central;
- profissionais associados a categorias;
- propostas e contratações como parte do produto.

---

## DEC-003 — Escopo inicial focado em serviços

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

A plataforma poderá evoluir futuramente, mas precisa validar primeiro a conexão entre clientes e profissionais.

### Decisão

O MVP será focado exclusivamente em serviços.

Não serão priorizados inicialmente:

- marketplace de produtos;
- pagamentos internos;
- aplicativos nativos;
- assinatura premium;
- seguro;
- garantia financeira;
- publicidade patrocinada;
- inteligência artificial avançada;
- geolocalização em tempo real.

### Motivo

Reduzir complexidade e validar a proposta central com rapidez.

### Impactos

O modelo de dados, a API e a interface não deverão antecipar funcionalidades de produtos ou pagamentos.

### Riscos

Adicionar funcionalidades fora desse escopo poderá atrasar a validação do MVP.

---

## DEC-004 — Monólito modular no backend

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

O backend precisa ser organizado e escalável sem introduzir a complexidade operacional de sistemas distribuídos.

### Decisão

O backend NestJS será desenvolvido como um monólito modular.

Os domínios possuirão módulos separados, mas serão executados inicialmente na mesma aplicação.

### Motivo

- maior velocidade de desenvolvimento;
- menor custo operacional;
- transações mais simples;
- facilidade de testes;
- facilidade de depuração;
- deploy simplificado;
- menor complexidade para a equipe inicial.

### Impactos

Os módulos deverão possuir responsabilidades claras e dependências controladas.

### Riscos

Um monólito sem limites internos poderá se tornar desorganizado.

### Mitigação

- organização por domínio;
- regras de negócio nos serviços;
- controllers pequenos;
- testes;
- documentação;
- revisão das dependências entre módulos.

---

## DEC-005 — Microsserviços somente mediante necessidade comprovada

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Microsserviços aumentam a complexidade de infraestrutura, observabilidade, testes e consistência.

### Decisão

A Soravi não utilizará microsserviços no MVP.

Uma separação futura somente será considerada quando houver:

- gargalo comprovado;
- necessidade de escalabilidade independente;
- equipes separadas por domínio;
- ciclos de deploy incompatíveis;
- necessidade de isolamento operacional;
- volume que justifique a divisão.

### Motivo

Evitar complexidade prematura.

### Impactos

Novos módulos deverão ser criados dentro do monólito modular enquanto não houver evidência para separação.

---

## DEC-006 — Estrutura de monorepo

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Frontend, backend, documentação e configurações compartilhadas precisam permanecer organizados no mesmo projeto.

### Decisão

A Soravi utilizará um monorepo com estrutura principal:

```text
apps/
  web/
  api/

packages/
docs/
infra/
```

### Motivo

- centralizar o desenvolvimento;
- facilitar mudanças coordenadas;
- compartilhar configurações;
- manter documentação próxima ao código;
- simplificar o início do projeto.

### Impactos

- frontend localizado em `apps/web`;
- backend localizado em `apps/api`;
- documentação localizada em `docs`;
- pacotes compartilhados localizados em `packages`.

### Regra

Entidades Prisma e implementações internas do backend não deverão ser compartilhadas diretamente com o frontend.

---

## DEC-007 — Stack oficial do frontend

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A stack oficial do frontend será:

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Lucide Icons
React Hook Form
Zod
TanStack Query
```

### Motivo

A stack oferece:

- tipagem;
- produtividade;
- componentes reutilizáveis;
- boa experiência de desenvolvimento;
- suporte a renderização no servidor;
- validação de formulários;
- controle de estado assíncrono.

### Impactos

Novas bibliotecas deverão ser adicionadas somente quando resolverem uma necessidade concreta.

---

## DEC-008 — Stack oficial do backend

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A stack oficial do backend será:

```text
NestJS
TypeScript
Prisma ORM
PostgreSQL
JWT
WebSockets
Redis, quando necessário
```

### Motivo

A combinação oferece modularidade, tipagem, integração com PostgreSQL e suporte aos fluxos do MVP.

### Impactos

Regras críticas deverão permanecer no backend.

---

## DEC-009 — PostgreSQL como fonte oficial de dados

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Solicitações, propostas, contratações, mensagens e avaliações precisam de consistência e histórico.

### Decisão

PostgreSQL será a fonte oficial dos dados permanentes da Soravi.

### Motivo

- suporte a transações;
- integridade referencial;
- confiabilidade;
- consultas relacionais;
- compatibilidade com Prisma;
- maturidade operacional.

### Impactos

Dados permanentes não poderão depender exclusivamente de cache, eventos ou memória da aplicação.

---

## DEC-010 — Uso restrito do Redis

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Redis pode ser útil, mas sua adoção precoce aumenta a infraestrutura e a manutenção.

### Decisão

Redis será utilizado somente quando existir necessidade concreta.

Possíveis usos:

- rate limiting distribuído;
- filas;
- cache;
- presença online;
- eventos temporários;
- comunicação entre instâncias;
- suporte a WebSockets em múltiplas instâncias.

### Motivo

Evitar uma dependência operacional antes de ela ser necessária.

### Impactos

Redis não será fonte oficial de:

- mensagens;
- notificações;
- propostas;
- contratações;
- estados de negócio.

---

## DEC-011 — Usuário com múltiplos papéis

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Uma mesma pessoa poderá contratar serviços e também prestar serviços.

### Decisão

A identidade do usuário será separada de seus papéis e perfis.

Um usuário poderá possuir:

```text
CUSTOMER
PROFESSIONAL
MODERATOR
ADMIN
```

O mesmo usuário poderá possuir perfil de cliente e profissional.

### Motivo

Evitar contas duplicadas e permitir evolução natural da jornada do usuário.

### Impactos

O modelo utilizará:

```text
User
UserRole
CustomerProfile
ProfessionalProfile
```

### Riscos

A autorização se torna mais detalhada.

### Mitigação

Cada operação deverá validar:

```text
usuário autenticado
+ papel
+ perfil
+ propriedade do recurso
+ estado atual
```

---

## DEC-012 — Contratação como entidade própria

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

O aceite de uma proposta precisa gerar um registro permanente das condições acordadas.

### Decisão

Será criada a entidade:

```text
Contract
```

Ela registrará:

- solicitação;
- proposta aceita;
- cliente;
- profissional;
- valor acordado;
- prazo acordado;
- mensagem acordada;
- status;
- datas do fluxo;
- cancelamento.

### Motivo

A proposta poderá mudar antes do aceite, mas as condições aceitas precisam permanecer preservadas.

### Impactos

A contratação será usada para:

- liberar o chat;
- iniciar o serviço;
- concluir o serviço;
- cancelar;
- permitir avaliação;
- manter histórico.

---

## DEC-013 — Uma contratação por solicitação

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Uma solicitação poderá gerar no máximo uma contratação.

Uma proposta poderá gerar no máximo uma contratação.

### Restrições previstas

```text
Contract.serviceRequestId UNIQUE
Contract.acceptedProposalId UNIQUE
```

### Motivo

Evitar aceites concorrentes e contratações duplicadas.

### Impactos

O aceite da proposta deverá ocorrer dentro de uma transação no PostgreSQL.

---

## DEC-014 — Chat somente após o aceite da proposta

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Havia possibilidade de conversa antes ou depois da contratação.

### Decisão

No MVP, o chat será liberado somente após o cliente aceitar uma proposta.

### Motivo

- reduzir spam;
- simplificar moderação;
- diminuir desintermediação precoce;
- tornar o fluxo previsível;
- reduzir a complexidade inicial.

### Impactos

- uma conversa estará vinculada a uma contratação;
- não haverá chat direto antes da contratação;
- dúvidas anteriores deverão ser tratadas por meio da proposta;
- cada contratação terá no máximo uma conversa.

### Evolução

A regra poderá ser revisada após dados e feedback dos usuários.

---

## DEC-015 — Transições explícitas de estado

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Permitir atualização genérica de status pode gerar estados inválidos e contornar regras de negócio.

### Decisão

Estados críticos serão alterados por ações específicas.

Exemplos:

```text
POST /service-requests/{id}/publish
POST /service-requests/{id}/cancel
POST /proposals/{id}/accept
POST /proposals/{id}/withdraw
POST /contracts/{id}/start
POST /contracts/{id}/complete
POST /contracts/{id}/cancel
```

### Motivo

Garantir que cada transição valide permissões, estado anterior e regras do domínio.

### Impactos

O backend não aceitará livremente qualquer `status` em endpoints genéricos.

---

## DEC-016 — Aceite de proposta como transação

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

O aceite de uma proposta será executado em uma única transação.

A operação deverá:

1. validar cliente e solicitação;
2. validar a proposta;
3. impedir aceite duplicado;
4. aceitar a proposta escolhida;
5. rejeitar as demais propostas ativas;
6. criar a contratação;
7. atualizar a solicitação;
8. criar a conversa;
9. criar notificações persistentes.

### Motivo

Evitar estados parciais e inconsistentes.

### Impactos

Eventos em tempo real somente deverão ser enviados depois da confirmação da transação.

---

## DEC-017 — Autenticação com sessões e rotação de refresh token

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Utilizar apenas um JWT sem estratégia de renovação e revogação não atende adequadamente aos requisitos de segurança.

### Decisão

A autenticação utilizará:

- access token de curta duração;
- refresh token com rotação;
- sessão registrada no banco;
- refresh token armazenado como hash;
- revogação de sessão;
- recuperação de senha com token temporário.

### Motivo

Permitir renovação segura, logout e encerramento de sessões comprometidas.

### Impactos

Será criada a entidade:

```text
AuthSession
```

Também serão previstas:

```text
PasswordResetToken
EmailVerificationToken
```

### Regra

Tokens sensíveis não deverão ser armazenados em texto puro.

---

## DEC-018 — Armazenamento seguro da autenticação no navegador

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A estratégia principal utilizará cookies com:

```text
HttpOnly
Secure
SameSite
```

Tokens sensíveis não deverão ser armazenados como estratégia principal em `localStorage`.

### Motivo

Reduzir exposição a ataques que consigam executar JavaScript no navegador.

### Impactos

A proteção contra CSRF deverá ser considerada conforme a implementação dos cookies.

---

## DEC-019 — Arquivos fora do PostgreSQL

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Fotos de perfil e imagens de solicitações precisam de armazenamento adequado.

### Decisão

Arquivos serão armazenados em serviço de objetos compatível com S3.

O PostgreSQL armazenará somente metadados.

### Entidade prevista

```text
FileAsset
```

### Motivo

- melhor escalabilidade;
- melhor entrega de arquivos;
- separação de responsabilidades;
- menor carga no banco;
- suporte a URLs assinadas.

### Impactos

Uploads deverão validar:

- proprietário;
- tipo real;
- tamanho;
- conteúdo permitido;
- nome interno;
- status do processamento.

---

## DEC-020 — Notificações persistentes antes do tempo real

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Notificações são importantes no MVP, mas a entrega em tempo real não precisa ser implementada primeiro.

### Decisão

As notificações iniciais serão persistidas no PostgreSQL.

A interface poderá consultá-las por:

- revalidação;
- polling controlado;
- abertura do painel.

WebSockets poderão ser adicionados posteriormente como mecanismo de entrega.

### Motivo

Garantir que notificações não sejam perdidas mesmo sem conexão em tempo real.

### Impactos

WebSockets não serão fonte oficial de notificações.

---

## DEC-021 — WebSocket não será fonte oficial das mensagens

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Mensagens serão persistidas no PostgreSQL antes da publicação do evento em tempo real.

### Fluxo

1. autenticar conexão;
2. validar participante;
3. validar conversa;
4. persistir mensagem;
5. confirmar transação;
6. emitir evento;
7. gerar notificação quando necessário.

### Motivo

Impedir perda de mensagens e preservar histórico.

### Impactos

Redis poderá ser utilizado futuramente para distribuir eventos entre instâncias, mas não armazenará o histórico oficial.

---

## DEC-022 — API REST versionada

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A API seguirá:

```text
REST
JSON
UTF-8
HTTPS
/api/v1
OpenAPI
```

### Motivo

Fornecer contratos previsíveis e documentados.

### Impactos

Endpoints de listagem deverão considerar:

- paginação;
- filtros permitidos;
- ordenação;
- respostas padronizadas;
- erros padronizados.

Operações de domínio utilizarão endpoints de ação quando necessário.

---

## DEC-023 — Regras de negócio concentradas no backend

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

O backend será responsável pela validação definitiva das regras de negócio.

O frontend poderá repetir validações apenas para melhorar a experiência do usuário.

### Motivo

Regras implementadas somente no frontend podem ser contornadas por requisições diretas.

### Impactos

O backend deverá validar:

- autenticação;
- papel;
- propriedade;
- estado;
- restrições;
- transições;
- integridade da operação.

---

## DEC-024 — Modelo de dados implementado incrementalmente

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

O modelo completo possui diversas entidades, mas criá-las todas de uma vez aumentaria o risco e o tamanho dos commits.

### Decisão

O `schema.prisma` será implementado em etapas.

### Etapa 1 — Fundação

```text
User
UserRole
CustomerProfile
ProfessionalProfile
LegalAcceptance
AuthSession
PasswordResetToken
EmailVerificationToken
```

### Etapa 2 — Categorias e serviços

```text
Category
ProfessionalCategory
ProfessionalServiceArea
ServiceRequest
FileAsset
ServiceRequestFile
```

### Etapa 3 — Propostas e contratação

```text
Proposal
Contract
Conversation
ConversationReadState
Message
```

### Etapa 4 — Relacionamento

```text
Review
Favorite
Notification
```

### Etapa 5 — Operação

```text
Verification
Report
ModerationAction
AuditLog
```

### Motivo

Manter commits pequenos, testáveis e alinhados às funcionalidades.

---

## DEC-025 — Valores monetários em centavos

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Valores monetários serão armazenados como números inteiros em centavos.

Exemplo:

```text
R$ 150,00 = 15000
```

### Motivo

Evitar erros de precisão de números de ponto flutuante.

### Impactos

A conversão para moeda formatada ocorrerá na apresentação.

---

## DEC-026 — Datas armazenadas em UTC

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Datas e horários persistidos serão armazenados em UTC.

### Motivo

Evitar inconsistências entre usuários, servidores e regiões.

### Impactos

A interface será responsável por apresentar datas no fuso adequado.

---

## DEC-027 — Identificadores UUID

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Entidades principais utilizarão UUID como identificador.

### Motivo

- geração segura;
- menor previsibilidade;
- facilidade para sistemas distribuídos futuros;
- ausência de dependência de sequência exposta.

### Impactos

O padrão definitivo deverá ser aplicado consistentemente no Prisma.

---

## DEC-028 — Exclusão lógica e anonimização

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Contexto

Algumas entidades precisam manter histórico, mas dados pessoais não devem ser mantidos sem necessidade.

### Decisão

Entidades com impacto operacional poderão utilizar:

```text
deletedAt
```

Dados pessoais poderão ser anonimizados conforme finalidade, retenção e obrigação aplicável.

### Motivo

Equilibrar integridade histórica, segurança, suporte e privacidade.

### Impactos

A exclusão de conta não significará necessariamente a remoção imediata de todos os registros relacionados.

---

## DEC-029 — LGPD e aceite versionado

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Termos e políticas terão versões registradas.

O aceite será representado por:

```text
LegalAcceptance
```

### Motivo

Permitir rastreabilidade e comprovação do documento aceito.

### Impactos

O sistema deverá permitir futuramente:

- correção de dados;
- exportação;
- exclusão ou anonimização;
- atualização dos aceites;
- política de retenção;
- registro de ações sensíveis.

---

## DEC-030 — Auditoria de ações administrativas

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Ações administrativas sensíveis deverão gerar registros de auditoria.

### Exemplos

- bloquear usuário;
- desbloquear usuário;
- alterar papel;
- remover conteúdo;
- aprovar verificação;
- rejeitar verificação;
- corrigir estado de contratação;
- acessar recurso sensível.

### Entidade prevista

```text
AuditLog
```

### Motivo

Garantir rastreabilidade, segurança e suporte operacional.

### Regra

Logs de auditoria não poderão conter senhas, tokens ou segredos.

---

## DEC-031 — Observabilidade desde o MVP

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A aplicação deverá possuir progressivamente:

- logs estruturados;
- identificador de requisição;
- monitoramento de erros;
- health checks;
- métricas essenciais;
- alertas para falhas críticas.

### Health checks previstos

```text
GET /health/live
GET /health/ready
```

### Motivo

Facilitar detecção, análise e correção de falhas.

### Impactos

Logs não deverão registrar dados sensíveis.

---

## DEC-032 — Ambientes separados

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A Soravi utilizará:

```text
desenvolvimento
homologação
produção
```

Cada ambiente deverá possuir:

- variáveis próprias;
- banco separado;
- credenciais separadas;
- armazenamento separado;
- configuração de monitoramento apropriada.

### Motivo

Evitar que testes ou desenvolvimento afetem usuários reais.

### Regra

Dados de produção não deverão ser copiados para ambientes inferiores sem anonimização.

---

## DEC-033 — Estratégia inicial de deploy

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A estratégia inicial será:

```text
Frontend: Vercel
Backend: serviço gerenciado compatível com Docker
Banco: PostgreSQL gerenciado
Arquivos: armazenamento compatível com S3
Redis: serviço gerenciado quando necessário
```

### Motivo

Reduzir manutenção de servidores durante o MVP.

### Impactos

Frontend e backend terão processos independentes de deploy.

### Pendente

Os fornecedores específicos do backend, banco, armazenamento e Redis ainda serão selecionados.

---

## DEC-034 — Fluxo Git simplificado

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

O projeto utilizará uma branch principal implantável e branches curtas:

```text
feature/*
fix/*
docs/*
refactor/*
chore/*
```

O nome desejado da branch principal será:

```text
main
```

### Contexto atual

O repositório poderá ainda utilizar `master`.

A renomeação não deverá ser feita de forma automática ou misturada com outro commit.

### Motivo

Uma equipe inicial pequena não precisa da complexidade permanente de `develop`.

### Impactos

A eventual migração de `master` para `main` será realizada em uma tarefa separada, após validar:

- repositório remoto;
- branch padrão no GitHub;
- pipelines;
- integrações;
- documentação.

---

## DEC-035 — Commits pequenos e objetivos

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

Cada commit deverá possuir um objetivo claro.

Formatos preferenciais:

```text
feat:
fix:
docs:
refactor:
test:
chore:
```

### Motivo

Facilitar revisão, histórico, correção e entendimento da evolução do projeto.

### Impactos

Uma funcionalidade grande deverá ser dividida em etapas menores.

---

## DEC-036 — Testes priorizando regras críticas

### Data

2026-07-30

### Status

```text
ACCEPTED
```

### Decisão

A prioridade de testes será:

1. autenticação;
2. autorização;
3. transições de estado;
4. criação de solicitação;
5. envio de proposta;
6. aceite de proposta;
7. criação de contratação;
8. liberação do chat;
9. conclusão do serviço;
10. avaliação.

### Motivo

Esses fluxos concentram maior impacto de segurança e negócio.

### Impactos

Testes visuais não deverão substituir testes de regras de negócio.

---

# 4. Decisões pendentes

As decisões abaixo ainda não estão aprovadas definitivamente.

## PEND-001 — Provedor de hospedagem do backend

### Status

```text
PROPOSED
```

Opções deverão ser comparadas considerando:

- preço;
- suporte a Docker;
- região;
- escalabilidade;
- logs;
- deploy;
- facilidade de operação.

---

## PEND-002 — Provedor de PostgreSQL

### Status

```text
PROPOSED
```

Deverá oferecer:

- backups;
- conexão segura;
- monitoramento;
- restauração;
- migrations controladas;
- região adequada.

---

## PEND-003 — Provedor de armazenamento de arquivos

### Status

```text
PROPOSED
```

Deverá oferecer:

- compatibilidade com S3;
- URLs assinadas;
- controle de acesso;
- política de retenção;
- custo previsível;
- entrega eficiente no Brasil.

---

## PEND-004 — Provedor de e-mail transacional

### Status

```text
PROPOSED
```

Será necessário para:

- verificação de e-mail;
- recuperação de senha;
- avisos de segurança;
- comunicações essenciais.

---

## PEND-005 — Serviço de monitoramento de erros

### Status

```text
PROPOSED
```

A escolha deverá considerar:

- integração com Next.js;
- integração com NestJS;
- rastreamento de erros;
- privacidade;
- custo;
- alertas.

---

## PEND-006 — Política de cancelamento

### Status

```text
PROPOSED
```

Ainda deverá ser definido:

- quem pode cancelar;
- em quais estados;
- motivos obrigatórios;
- impacto na reputação;
- tratamento após início do serviço;
- necessidade de moderação.

---

## PEND-007 — Política de retenção de mensagens e logs

### Status

```text
PROPOSED
```

Ainda deverão ser definidos os prazos para:

- mensagens;
- notificações;
- sessões;
- tokens;
- arquivos;
- auditoria;
- logs técnicos;
- denúncias.

---

# 5. Processo para novas decisões

Uma nova decisão relevante deverá seguir estas etapas:

1. Descrever o problema.
2. Apresentar alternativas.
3. Explicar vantagens e riscos.
4. Obter aprovação do fundador.
5. Registrar a decisão.
6. Atualizar os documentos relacionados.
7. Implementar em commit separado quando necessário.
8. Validar o impacto no projeto.

Mudanças estruturais não deverão ser aplicadas silenciosamente.

---

# 6. Documentos relacionados

Este documento deverá permanecer alinhado com:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/ROADMAP.md
README.md
CHANGELOG.md
```

Em caso de conflito, a decisão mais recente e explicitamente aprovada deverá ser analisada antes de alterar o projeto.

---

# 7. Histórico do documento

## 2026-07-30

### Alteração

Criação do documento de decisões.

### Motivo

Registrar oficialmente as decisões aprovadas durante a revisão da arquitetura e do modelo de dados.

### Impacto

Os próximos commits de documentação e código deverão seguir as decisões registradas neste documento.

---

# 8. Diretriz final

A Soravi deverá evoluir de maneira incremental, segura e orientada às necessidades reais do produto.

As decisões registradas neste documento não são imutáveis, mas não poderão ser alteradas sem análise, justificativa e novo registro.

O objetivo é preservar consistência sem impedir a evolução.