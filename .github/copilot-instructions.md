# Instruções do projeto Soravi

## Contexto

A Soravi é uma plataforma brasileira que conecta pessoas a profissionais e soluções de serviços.

A proposta central é:

> A Soravi conecta pessoas a soluções.

A experiência principal deve começar por:

> Como podemos ajudar você hoje?

A Soravi não deve ser tratada como um simples site de classificados.

## Públicos principais

- cliente;
- profissional;
- administrador;
- moderador.

## Stack oficial

### Frontend

- Next.js;
- React;
- TypeScript estrito;
- Tailwind CSS;
- shadcn/ui;
- Lucide Icons;
- React Hook Form;
- Zod;
- TanStack Query.

### Backend

- NestJS;
- TypeScript estrito;
- Prisma ORM;
- PostgreSQL;
- Redis somente quando necessário;
- JWT;
- WebSockets.

## Arquitetura

- usar monólito modular;
- não criar microsserviços prematuramente;
- manter regras de negócio no backend;
- usar PostgreSQL como fonte principal de dados;
- usar Redis apenas quando necessário;
- evitar duplicação de regras;
- evitar arquivos excessivamente grandes;
- separar responsabilidades por módulo;
- manter controllers simples;
- manter validações em DTOs;
- manter regras de negócio nos services.

## Regras de desenvolvimento

- usar TypeScript estrito;
- não usar `any`;
- validar todas as entradas;
- tratar erros;
- usar nomes claros;
- não duplicar regras de negócio;
- nunca colocar segredos no código;
- não editar arquivos `.env`;
- não expor tokens, senhas ou hashes;
- não alterar dependências sem autorização;
- não atualizar versões de pacotes sem autorização;
- não criar migration sem autorização expressa;
- não apagar arquivos sem autorização;
- não executar comandos destrutivos;
- não executar `git commit`;
- não executar `git push`;
- não executar deploy;
- não alterar decisões estruturais sem explicar vantagens e riscos.

## Documentação oficial

Antes de implementar, consultar quando relevante:

- `docs/00-contexto-geral.md`;
- `docs/01-visao-do-produto.md`;
- `docs/02-regras-de-negocio.md`;
- `docs/03-arquitetura-tecnica.md`;
- `docs/04-modelo-de-dados.md`;
- `docs/06-roadmap.md`;
- `docs/07-backlog.md`;
- `docs/08-decisoes-do-projeto.md`;
- `docs/09-api.md`;
- `docs/10-padroes-de-codigo.md`;
- `docs/12-documentacao-tecnica-v2.md`;
- `CHANGELOG.md`.

Os documentos do projeto são a fonte oficial.

Quando houver conflito entre código, documentos ou instruções, não alterar silenciosamente. Apresentar o conflito antes de continuar.

## Processo obrigatório

Para cada tarefa:

1. verificar `git status --short`;
2. confirmar que o repositório está limpo;
3. ler os arquivos relacionados;
4. ler os documentos oficiais relevantes;
5. apresentar um plano curto antes de editar;
6. informar quais arquivos serão criados ou alterados;
7. modificar somente os arquivos necessários;
8. executar formatação;
9. executar build;
10. executar testes;
11. mostrar os arquivos alterados;
12. mostrar o resultado dos comandos;
13. mostrar o resumo do `git diff`;
14. não criar commit.

## Segurança

- considerar LGPD desde o início;
- não expor dados pessoais;
- não retornar senha, hash de senha ou hashes de tokens;
- manter autenticação e autorização no backend;
- preservar logs e históricos relevantes;
- validar sessão no PostgreSQL;
- respeitar papéis de usuário;
- não confiar apenas em dados enviados pelo frontend;
- não registrar tokens completos em logs.

## Regras atuais de autenticação

- cadastro público permite apenas `CUSTOMER` e `PROFESSIONAL`;
- login permitido para contas `PENDING` e `ACTIVE`;
- contas `SUSPENDED`, `BLOCKED` e `DEACTIVATED` não podem realizar login;
- access token deve estar vinculado a uma sessão válida;
- refresh token deve ser armazenado somente como hash;
- refresh token deve ser rotacionado;
- refresh token antigo não pode ser reutilizado;
- logout deve revogar a sessão;
- rotas podem exigir papéis com `@Roles`;
- usuário sem papel necessário recebe `INSUFFICIENT_PERMISSIONS`.

## Regras atuais de categorias

- categorias oficiais ficam em `Category`;
- solicitações de novas categorias ficam em `CategoryRequest`;
- a ausência de categoria não pode impedir o cadastro profissional;
- categorias sugeridas não são publicadas automaticamente;
- solicitações começam com status `PENDING`;
- solicitações podem ser `APPROVED`, `REJECTED` ou `MERGED`;
- uma solicitação `MERGED` pode apontar para uma categoria existente;
- somente categorias ativas aparecem publicamente;
- administração e moderação analisam solicitações.

## Escopo atual

Próxima funcionalidade planejada:

> Listagem pública de categorias de serviços ativas.

A implementação deve:

- criar `CategoriesModule`;
- criar `CategoriesService`;
- criar `CategoriesController`;
- criar DTO de resposta;
- criar `GET /api/v1/categories`;
- retornar somente categorias com `isActive = true`;
- ordenar por `displayOrder` crescente;
- usar `name` crescente como segundo critério;
- criar testes automatizados;
- registrar o módulo no `AppModule`;
- não alterar o schema Prisma;
- não criar migration;
- não alterar autenticação;
- não alterar autorização;
- não instalar dependências;
- não fazer commit.