# 03 — Arquitetura Técnica

## 1. Objetivo

Este documento define a arquitetura técnica oficial da Soravi para o desenvolvimento do MVP.

A arquitetura deve permitir:

* desenvolvimento rápido e incremental;
* separação clara de responsabilidades;
* segurança desde o início;
* facilidade de manutenção e testes;
* evolução sem complexidade prematura;
* crescimento gradual da plataforma.

A Soravi será construída inicialmente como um **monólito modular**, com frontend, backend, banco de dados e armazenamento de arquivos separados por responsabilidade.

---

## 2. Princípios arquiteturais

Todas as decisões técnicas devem respeitar os seguintes princípios:

1. Simplicidade antes de complexidade.
2. Regras de negócio concentradas no backend.
3. PostgreSQL como fonte principal de dados.
4. Redis somente quando houver necessidade concreta.
5. Segurança e privacidade consideradas desde o início.
6. Componentes e módulos com responsabilidades bem definidas.
7. Dependências entre módulos mantidas sob controle.
8. Desenvolvimento incremental, commit por commit.
9. Observabilidade e tratamento de erros desde o MVP.
10. Microsserviços somente quando houver evidência real de necessidade.

---

## 3. Arquitetura geral

A Soravi será composta inicialmente por:

```text
Usuário
   │
   ▼
Frontend — Next.js
   │
   │ HTTPS / REST API / WebSocket
   ▼
Backend — NestJS
   │
   ├── PostgreSQL
   ├── Armazenamento de arquivos
   └── Redis, quando necessário
```

### Responsabilidades

#### Frontend

Responsável por:

* interface do usuário;
* navegação;
* formulários;
* validações para experiência de uso;
* consumo da API;
* apresentação de erros e estados de carregamento;
* comunicação em tempo real com o backend.

O frontend não deve acessar diretamente o banco de dados.

#### Backend

Responsável por:

* autenticação;
* autorização;
* regras de negócio;
* validação definitiva das entradas;
* controle das transições de estado;
* persistência dos dados;
* envio de notificações;
* comunicação em tempo real;
* auditoria e moderação.

#### PostgreSQL

Será a fonte oficial e permanente dos dados da plataforma.

#### Redis

Será utilizado apenas para necessidades temporárias ou distribuídas, como:

* rate limiting;
* filas;
* cache;
* presença online;
* comunicação entre instâncias;
* eventos em tempo real;
* controle temporário de sessões, quando necessário.

Redis não deve ser a única fonte de informações importantes para o negócio.

#### Armazenamento de arquivos

Será utilizado para:

* fotos de perfil;
* imagens de solicitações;
* arquivos permitidos futuramente;
* conteúdos enviados pelos usuários.

Os arquivos não serão armazenados diretamente no PostgreSQL.

---

## 4. Estilo arquitetural

### 4.1 Monólito modular

O backend será desenvolvido como um monólito modular.

Cada domínio da plataforma terá seu próprio módulo, com responsabilidades bem definidas.

Todos os módulos serão executados inicialmente dentro da mesma aplicação NestJS e utilizarão o mesmo banco PostgreSQL.

### Vantagens para o MVP

* menor complexidade operacional;
* desenvolvimento mais rápido;
* facilidade de testes;
* transações mais simples;
* menor custo de infraestrutura;
* facilidade de depuração;
* deploy centralizado do backend.

### Microsserviços

A Soravi não adotará microsserviços durante o MVP.

Uma futura divisão somente deverá ser considerada quando houver evidências como:

* necessidade de escalabilidade independente;
* gargalos comprovados;
* equipes separadas por domínio;
* ciclos de deploy incompatíveis;
* necessidade de isolamento operacional;
* alto volume em um módulo específico.

Qualquer migração futura deverá ser registrada como decisão arquitetural.

---

## 5. Stack técnica oficial

### 5.1 Frontend

* Next.js;
* React;
* TypeScript;
* Tailwind CSS;
* shadcn/ui;
* Lucide Icons;
* React Hook Form;
* Zod;
* TanStack Query.

### 5.2 Backend

* NestJS;
* TypeScript;
* Prisma ORM;
* PostgreSQL;
* JWT;
* WebSockets;
* Redis, quando necessário.

### 5.3 Infraestrutura

* GitHub;
* Docker;
* Vercel para o frontend;
* serviço gerenciado compatível com Docker para o backend;
* PostgreSQL gerenciado;
* armazenamento de arquivos compatível com S3;
* Redis gerenciado, quando necessário;
* serviço de monitoramento de erros.

---

## 6. Organização do repositório

A Soravi deverá evoluir para uma estrutura de monorepo.

Estrutura recomendada:

```text
soravi/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   └── public/
│   │
│   └── api/
│       ├── src/
│       │   ├── common/
│       │   ├── config/
│       │   ├── modules/
│       │   └── main.ts
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
│
├── packages/
│   ├── eslint-config/
│   ├── typescript-config/
│   └── contracts/
│
├── docs/
├── docker/
├── .github/
├── package.json
└── README.md
```

A reorganização deverá ser incremental.

O projeto Next.js já existente não deverá ser descartado. Ele deverá ser movido ou adaptado com segurança quando a estrutura de monorepo for implementada.

---

## 7. Organização do frontend

### Diretórios principais

#### `app`

Responsável por:

* rotas;
* layouts;
* páginas;
* loading states;
* error boundaries;
* componentes de rota.

#### `components`

Componentes reutilizáveis e genéricos da interface.

Exemplos:

* Button;
* Input;
* Modal;
* Avatar;
* Badge;
* Header;
* Footer.

#### `features`

Organização das funcionalidades por domínio.

Exemplos:

```text
features/
├── auth/
├── professionals/
├── service-requests/
├── proposals/
├── conversations/
└── notifications/
```

Cada feature poderá possuir:

```text
feature/
├── components/
├── hooks/
├── schemas/
├── services/
├── types/
└── utils/
```

#### `hooks`

Hooks reutilizáveis que não pertencem a uma única funcionalidade.

#### `lib`

Configurações e utilidades gerais.

Exemplos:

* cliente HTTP;
* configuração do TanStack Query;
* formatação;
* utilidades de autenticação;
* validações compartilhadas.

#### `types`

Tipos globais do frontend.

### Regras do frontend

* utilizar Server Components quando apropriado;
* utilizar Client Components somente quando necessário;
* não duplicar regras críticas do backend;
* validar formulários com React Hook Form e Zod;
* tratar estados de carregamento, erro e ausência de dados;
* manter interfaces mobile-first;
* respeitar WCAG 2.1 nível AA;
* evitar componentes excessivamente grandes;
* não armazenar credenciais sensíveis no código.

---

## 8. Organização do backend

O backend será organizado por módulos de domínio.

Estrutura inicial recomendada:

```text
modules/
├── auth/
├── users/
├── customer-profiles/
├── professional-profiles/
├── categories/
├── service-requests/
├── proposals/
├── contracts/
├── conversations/
├── messages/
├── reviews/
├── favorites/
├── notifications/
├── uploads/
├── verification/
├── moderation/
└── admin/
```

### Estrutura interna de um módulo

```text
module/
├── controllers/
├── services/
├── dto/
├── entities/
├── guards/
├── policies/
├── validators/
├── repositories/
└── module.ts
```

Nem todos os módulos precisarão de todos esses diretórios.

A estrutura deverá ser criada conforme a necessidade real de cada funcionalidade.

### Responsabilidades

#### Controllers

Responsáveis por:

* receber requisições;
* validar parâmetros básicos;
* chamar os serviços;
* retornar respostas HTTP.

Controllers não devem concentrar regras de negócio.

#### Services

Responsáveis por:

* executar casos de uso;
* aplicar regras de negócio;
* coordenar acesso aos dados;
* controlar transações;
* produzir erros de domínio.

#### DTOs

Responsáveis por:

* definir entradas e saídas;
* validar dados;
* documentar contratos da API.

#### Guards e Policies

Responsáveis por:

* autenticação;
* autorização por papel;
* autorização por propriedade do recurso;
* verificação de permissões específicas.

#### Repositories

Poderão ser utilizados quando ajudarem a isolar consultas complexas ou regras de persistência.

Não devem ser criados apenas como abstração artificial sobre o Prisma.

---

## 9. Módulos principais do domínio

### Auth

Responsável por:

* cadastro;
* login;
* logout;
* refresh token;
* recuperação de senha;
* redefinição de senha;
* verificação de e-mail;
* gerenciamento de sessões.

### Users

Responsável pela identidade principal do usuário.

Um usuário poderá possuir mais de um papel na plataforma.

Exemplo:

* cliente;
* profissional;
* administrador;
* moderador.

### Customer Profiles

Responsável pelos dados específicos do cliente.

### Professional Profiles

Responsável por:

* descrição profissional;
* categorias atendidas;
* área de atendimento;
* verificação;
* reputação;
* dados públicos do profissional.

### Categories

Responsável pelas categorias de serviços.

### Service Requests

Responsável pelas solicitações criadas pelos clientes.

### Proposals

Responsável pelas propostas enviadas pelos profissionais.

Um profissional poderá manter apenas uma proposta ativa por solicitação.

### Contracts

Responsável pela contratação resultante do aceite de uma proposta.

A contratação deverá ser uma entidade própria.

Ela será usada para:

* registrar a proposta aceita;
* preservar as condições acordadas;
* liberar a conversa;
* iniciar o serviço;
* concluir o serviço;
* cancelar a contratação;
* permitir avaliação.

### Conversations e Messages

Responsáveis pelo chat entre cliente e profissional.

No MVP, o chat será liberado somente após o aceite da proposta.

### Reviews

Responsável pelas avaliações após a conclusão do serviço.

### Favorites

Responsável por permitir que clientes salvem profissionais.

### Notifications

Responsável pelas notificações persistentes da plataforma.

Notificações em tempo real serão adicionadas somente quando necessárias.

### Uploads

Responsável por validar e autorizar o envio de arquivos.

### Verification

Responsável pela verificação básica de usuários e profissionais.

### Moderation

Responsável por denúncias, bloqueios e ações de moderação.

### Admin

Responsável pelas funções administrativas e indicadores da plataforma.

---

## 10. Banco de dados

### Fonte principal

PostgreSQL será a única fonte oficial para os dados permanentes de negócio.

Exemplos:

* usuários;
* perfis;
* solicitações;
* propostas;
* contratações;
* conversas;
* mensagens;
* avaliações;
* notificações;
* ações administrativas.

### Prisma ORM

Prisma será utilizado para:

* definição do schema;
* migrations;
* consultas;
* transações;
* seeds;
* acesso tipado ao banco.

### Regras

* migrations devem ser versionadas;
* alterações de schema devem ser revisadas;
* produção não deve utilizar `prisma db push`;
* migrations de produção devem ser executadas de forma controlada;
* índices devem ser definidos conforme os padrões de consulta;
* exclusões sensíveis devem considerar soft delete;
* datas devem ser armazenadas em UTC;
* dinheiro deve ser armazenado em unidade inteira, como centavos;
* IDs deverão utilizar UUID, CUID ou padrão oficialmente definido no modelo de dados.

---

## 11. Estados e transições de negócio

Estados importantes deverão ser controlados pelo backend.

Não será permitido alterar livremente estados críticos por meio de um endpoint genérico.

### Exemplos de ações explícitas

```text
POST /service-requests/{id}/publish
POST /service-requests/{id}/cancel

POST /proposals/{id}/accept
POST /proposals/{id}/withdraw

POST /contracts/{id}/start
POST /contracts/{id}/complete
POST /contracts/{id}/cancel
```

Cada transição deverá validar:

* usuário autenticado;
* papel permitido;
* propriedade do recurso;
* estado atual;
* transição solicitada;
* regras adicionais do domínio.

As transições oficiais serão detalhadas no documento de regras de negócio e no modelo de dados.

---

## 12. API

A API seguirá os seguintes padrões:

* REST;
* JSON;
* UTF-8;
* HTTPS obrigatório;
* versionamento por `/api/v1`;
* documentação OpenAPI/Swagger;
* autenticação via JWT;
* respostas de erro padronizadas;
* paginação em endpoints de listagem;
* filtros explicitamente permitidos;
* validação de todas as entradas.

### Padrão de erro

Exemplo:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Os dados enviados são inválidos.",
  "details": [
    {
      "field": "email",
      "message": "Informe um e-mail válido."
    }
  ],
  "requestId": "identificador-da-requisicao"
}
```

A API não deverá expor:

* stack traces;
* mensagens internas do banco;
* detalhes de infraestrutura;
* segredos;
* informações sensíveis.

---

## 13. Autenticação e sessões

A autenticação será baseada em:

* access token de curta duração;
* refresh token com rotação;
* sessões registradas;
* revogação de sessão;
* recuperação de senha com token temporário.

### Regras recomendadas

* senhas armazenadas com Argon2id;
* refresh tokens armazenados como hash;
* tokens sensíveis não devem ser armazenados em texto puro;
* cookies devem utilizar `HttpOnly`, `Secure` e `SameSite`;
* logout deve revogar a sessão;
* usuário poderá revogar todas as sessões;
* login e recuperação de senha deverão possuir rate limiting;
* mensagens não devem revelar se um e-mail existe ou não;
* tokens de recuperação deverão expirar e ser utilizados uma única vez.

O armazenamento de tokens sensíveis em `localStorage` não será adotado como estratégia principal.

---

## 14. Autorização

A autorização não deverá depender apenas do papel do usuário.

Cada operação deverá validar:

```text
autenticação
+ papel
+ propriedade do recurso
+ estado atual
+ regra específica da ação
```

Exemplo:

Um cliente autenticado não poderá editar uma solicitação pertencente a outro cliente.

Um profissional não poderá enviar proposta para uma solicitação encerrada.

Um usuário não poderá acessar uma conversa da qual não participa.

Um cliente somente poderá avaliar uma contratação concluída da qual seja parte.

---

## 15. Chat e WebSockets

WebSockets serão utilizados para comunicação em tempo real.

### Fluxo recomendado

1. Usuário abre uma conexão autenticada.
2. Backend valida a sessão.
3. Usuário envia uma mensagem.
4. Backend valida o acesso à conversa.
5. Mensagem é persistida no PostgreSQL.
6. Backend confirma o recebimento.
7. Evento é enviado aos participantes autorizados.
8. Notificação é criada quando necessário.

### Regras

* PostgreSQL será a fonte oficial das mensagens;
* WebSocket não substituirá a persistência;
* cliente não poderá definir livremente o remetente;
* acesso à conversa deverá ser validado em cada operação;
* Redis será utilizado para WebSockets apenas quando houver múltiplas instâncias ou necessidade comprovada;
* mensagens devem possuir identificador e data gerados pelo servidor.

---

## 16. Notificações

As notificações do MVP serão armazenadas no PostgreSQL.

Campos básicos:

* usuário destinatário;
* tipo;
* título;
* mensagem;
* recurso relacionado;
* data de criação;
* data de leitura.

A atualização poderá começar com:

* revalidação;
* polling controlado;
* consulta ao abrir o painel.

Notificações em tempo real poderão ser adicionadas posteriormente com WebSockets.

---

## 17. Upload e armazenamento de arquivos

Arquivos serão armazenados em serviço compatível com S3.

### Fluxo recomendado

1. Frontend solicita autorização.
2. Backend valida o usuário e o contexto.
3. Backend gera URL assinada.
4. Frontend envia o arquivo.
5. Backend registra os metadados.
6. Arquivo é validado ou processado quando necessário.

### Requisitos

* limite de tamanho;
* tipos de arquivo permitidos;
* validação do MIME type real;
* nome interno gerado pelo sistema;
* proibição de executáveis;
* URLs privadas ou assinadas;
* política de remoção;
* remoção de metadados sensíveis de imagens, quando aplicável;
* registro do proprietário do arquivo;
* possibilidade de bloquear arquivos em análise.

---

## 18. Segurança

A arquitetura deverá incluir:

* HTTPS obrigatório;
* hash seguro de senhas;
* autenticação e autorização;
* validação de todas as entradas;
* CORS restrito;
* rate limiting;
* headers de segurança;
* proteção contra SQL Injection;
* proteção contra XSS;
* proteção contra CSRF conforme a estratégia de autenticação;
* logs estruturados;
* auditoria administrativa;
* gerenciamento seguro de segredos;
* backups;
* testes de restauração;
* tratamento padronizado de erros.

Credenciais e segredos deverão ser armazenados exclusivamente em variáveis de ambiente ou serviços de gerenciamento de segredos.

Nenhuma credencial poderá ser colocada diretamente no código ou no repositório.

---

## 19. LGPD e privacidade

A arquitetura deverá permitir:

* consentimento e aceite de termos;
* versionamento de termos e políticas;
* correção de dados pessoais;
* exportação de dados;
* exclusão ou anonimização;
* política de retenção;
* controle de acesso administrativo;
* registro de ações sensíveis;
* minimização dos dados coletados;
* proteção de dados pessoais;
* resposta a incidentes.

Logs não deverão armazenar dados pessoais além do necessário.

Mensagens, documentos e informações sensíveis deverão possuir acesso restrito.

---

## 20. Observabilidade

A aplicação deverá possuir:

* logs estruturados;
* monitoramento de erros;
* identificador de requisição;
* métricas de desempenho;
* health checks;
* monitoramento de disponibilidade;
* alertas para falhas críticas.

### Health checks

```text
GET /health/live
GET /health/ready
```

### Campos recomendados nos logs

```text
timestamp
level
requestId
method
route
statusCode
duration
userId, quando permitido
errorCode
```

Não deverão ser registrados:

* senhas;
* tokens;
* códigos de recuperação;
* credenciais;
* documentos pessoais completos;
* informações sigilosas desnecessárias.

---

## 21. Ambientes

A Soravi terá inicialmente três ambientes:

### Desenvolvimento

Utilizado pelos desenvolvedores localmente.

### Homologação

Utilizado para:

* validação;
* testes integrados;
* revisão;
* demonstrações;
* aprovação antes da produção.

### Produção

Ambiente utilizado pelos usuários reais.

Cada ambiente deverá possuir:

* banco separado;
* credenciais separadas;
* variáveis próprias;
* armazenamento separado;
* monitoramento apropriado.

Dados de produção não deverão ser copiados para ambientes inferiores sem anonimização.

---

## 22. Deploy

### Frontend

Hospedado inicialmente na Vercel.

### Backend

Empacotado com Docker e hospedado em serviço gerenciado compatível.

### Banco de dados

PostgreSQL gerenciado com:

* backups automáticos;
* conexão segura;
* monitoramento;
* política de restauração.

### Arquivos

Armazenamento em nuvem compatível com S3.

### Redis

Serviço gerenciado somente quando sua utilização for necessária.

O frontend e o backend deverão possuir processos de deploy independentes.

---

## 23. Integração contínua

O pipeline deverá executar progressivamente:

* instalação de dependências;
* lint;
* verificação de tipos;
* testes unitários;
* testes de integração;
* build;
* validação de migrations;
* análise de segurança das dependências.

Deploy em produção deverá depender da aprovação e da estabilidade do pipeline.

---

## 24. Estratégia Git

Fluxo recomendado para a equipe inicial:

```text
main
feature/*
fix/*
docs/*
refactor/*
chore/*
```

### Regras

* `main` deverá permanecer implantável;
* branches deverão ter vida curta;
* cada branch deverá possuir objetivo claro;
* pull requests deverão ser pequenos;
* commits deverão ser objetivos;
* alterações importantes deverão atualizar a documentação.

A branch `develop` poderá ser adotada futuramente caso o processo da equipe passe a exigir uma etapa permanente de integração.

---

## 25. Testes

### Testes unitários

Prioridade para:

* regras de negócio;
* transições de estado;
* autenticação;
* autorização;
* aceite de proposta;
* conclusão de contrato;
* avaliação.

### Testes de integração

Prioridade para:

* API;
* PostgreSQL;
* Prisma;
* módulos integrados;
* autenticação e sessões.

### Testes E2E

Fluxos críticos:

1. Cadastro.
2. Login.
3. Criação de solicitação.
4. Envio de proposta.
5. Aceite da proposta.
6. Liberação do chat.
7. Conclusão do serviço.
8. Avaliação.

---

## 26. Regras de evolução

Antes de adicionar uma nova tecnologia, deverá ser respondido:

1. Qual problema concreto ela resolve?
2. Esse problema existe atualmente?
3. A solução atual é insuficiente?
4. Qual será o custo de operação?
5. Qual será o impacto na manutenção?
6. A equipe consegue suportá-la?
7. Existe uma alternativa mais simples?

Tecnologias não deverão ser adicionadas apenas por tendência ou possibilidade futura.

---

## 27. Decisões oficiais desta versão

Esta versão oficializa:

1. Uso de monólito modular no MVP.
2. Separação entre frontend Next.js e backend NestJS.
3. PostgreSQL como fonte principal de dados.
4. Redis somente quando houver necessidade concreta.
5. Inclusão de uma entidade própria de contratação.
6. Possibilidade de um usuário possuir perfil de cliente e profissional.
7. Chat liberado somente após o aceite da proposta no MVP.
8. Uso de access token e refresh token com rotação.
9. Armazenamento de arquivos fora do banco.
10. Controle explícito das transições de estado.
11. Organização progressiva do projeto como monorepo.
12. Regras de negócio e autorização concentradas no backend.
13. Adoção de observabilidade, segurança e LGPD desde o início.
14. Microsserviços somente após necessidade comprovada.

---

## 28. Diretriz final

A arquitetura da Soravi deverá permanecer simples, segura, modular e preparada para evolução.

O objetivo não é antecipar toda a infraestrutura de uma empresa de grande escala.

O objetivo é construir uma base profissional que permita validar o MVP, aprender com os usuários e evoluir com segurança, sem comprometer a velocidade de desenvolvimento.
