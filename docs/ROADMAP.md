# Roadmap de Engenharia

1. Fundação
2. Banco e Prisma
3. Autenticação
4. Perfis
5. Solicitações
6. Propostas
7. Chat
8. Avaliações
9. Administração
10. Beta

## Estado atual de autenticação e segurança

### Concluído

- fundação backend e frontend de verificação de telefone;
- redirecionamento pós-login e guard frontend centralizado;
- enforcement backend explícito em ações sensíveis;
- alteração segura do próprio telefone;
- recuperação e redefinição de senha ponta a ponta, com backend, adapter Resend e frontends `/recuperar-senha` e `/redefinir-senha`;
- validação manual real do fluxo pela interface, incluindo delivery, expiração, redefinição e novo login;
- invalidação de tokens pendentes na troca administrativa de senha;
- hardening compatível de dependências concluído em 2026-09-02, reduzindo o baseline de `npm audit --omit=dev` de 14 para 6 vulnerabilidades, sem `npm audit fix --force` e com TypeScript, 62 suítes/678 testes da API e builds da API e do frontend aprovados;
- infraestrutura inicial da Meta: número oficial dedicado à Soravi, WABA existente e número registrado na WhatsApp Cloud API.

### Pendente

- dependência externa/pré-beta da Meta: concluir Business Verification quando houver estrutura jurídica adequada e obter permissão para criar o template de autenticação pretendido `codigo_verificacao_soravi` (`AUTHENTICATION`, `pt_BR`, `COPY_CODE`, expiração de 10 minutos); a tentativa atual foi recusada pela Meta por falta de permissão da WABA;
- validar o envio real de OTP, configurar e assinar o webhook e somente então ativar o provider Meta em produção; a integração não está operacional para OTP;
- revisar antes do beta e a cada atualização compatível upstream o risco residual conhecido das 6 vulnerabilidades, concentrado em `deepmerge-ts` 7.1.5 (`@prisma/config`), `mysql2` 3.15.3 (Prisma/tooling; a Soravi usa PostgreSQL) e `postcss` 8.4.31 (interno do Next.js 15.5.25), sem aplicar overrides internos apenas para zerar o `npm audit` sem validação de compatibilidade;
- hardening obrigatório pré-beta ainda pendente: CSP/XSS, proteção de sessão e tokens, cookies/refresh, revisão de rate limits e revisão OWASP ASVS;
- favoritos, avaliações e demais etapas ainda não implementadas.

O bloqueio externo da Meta não interrompe o restante do desenvolvimento do MVP.

## Pré-beta — importante

### SEO técnico, indexação e identidade digital da Soravi

Objetivo: ajudar mecanismos de busca a reconhecer `soravi.com.br` como a
plataforma brasileira Soravi de serviços e profissionais, sem ultrapassar as
funcionalidades críticas do MVP em prioridade.

- configurar Google Search Console, `sitemap.xml`, `robots.txt` e canonical;
- revisar metadata, Open Graph e consistência da descrição institucional;
- publicar JSON-LD `Organization` e `WebSite`, associando redes oficiais com `sameAs`;
- solicitar a indexação das principais páginas públicas;
- monitorar buscas por Soravi e Soravi Brasil e possível confusão com outras entidades chamadas Soravi.
