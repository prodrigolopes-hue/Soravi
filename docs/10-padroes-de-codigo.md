# 10 - Padrões de Código

# Objetivo

Estabelecer convenções de desenvolvimento para manter a qualidade,
legibilidade e consistência do código da Soravi.

------------------------------------------------------------------------

# Linguagem

-   TypeScript em todo o projeto.
-   Evitar uso de `any`.
-   Preferir tipagem explícita.

------------------------------------------------------------------------

# Estrutura de Pastas

Frontend: - components/ - features/ - hooks/ - lib/ - types/ - app/

Backend: - modules/ - controllers/ - services/ - dto/ - entities/ -
guards/ - prisma/

------------------------------------------------------------------------

# Convenções de Nomenclatura

Arquivos: - kebab-case

Componentes React: - PascalCase

Variáveis e funções: - camelCase

Constantes: - UPPER_SNAKE_CASE

Interfaces: - Prefixo `I` (ex.: IUser)

Enums: - PascalCase

------------------------------------------------------------------------

# React / Next.js

-   Componentes pequenos e reutilizáveis.
-   Separar lógica da apresentação.
-   Utilizar Server Components quando apropriado.
-   Client Components apenas quando necessário.

------------------------------------------------------------------------

# NestJS

Cada módulo deve conter:

-   controller
-   service
-   dto
-   entity
-   module

Responsabilidades bem definidas e baixa dependência entre módulos.

------------------------------------------------------------------------

# Git

-   Commits pequenos.
-   Mensagens claras.
-   Uma funcionalidade por commit.

Exemplo:

feat(auth): criar login

fix(chat): corrigir envio de mensagens

------------------------------------------------------------------------

# Testes

Prioridade para:

-   regras de negócio;
-   autenticação;
-   serviços críticos.

------------------------------------------------------------------------

# Documentação

Toda funcionalidade nova deve atualizar:

-   backlog;
-   documentação técnica;
-   decisões do projeto (quando aplicável).

------------------------------------------------------------------------

# Revisão de Código

Antes de aprovar um código, verificar:

-   legibilidade;
-   segurança;
-   desempenho;
-   aderência aos padrões;
-   ausência de duplicação.

------------------------------------------------------------------------

# Princípio Final

Todo código desenvolvido para a Soravi deve ser simples, bem
documentado, fácil de testar e preparado para evoluções futuras.
