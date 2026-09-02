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
- invalidação de tokens pendentes na troca administrativa de senha.

### Pendente

- onboarding/configuração segura da Meta e avaliação de coexistência com o WhatsApp Business/Cloud API; o número da Soravi está disponível e cadastrado no WhatsApp Business, mas Cloud API, WABA e templates ainda não estão confirmados como ativos;
- hardening obrigatório pré-beta: auditoria de dependências, investigação das vulnerabilidades npm sem `npm audit fix --force`, CSP/XSS, proteção de sessão e tokens, cookies/refresh, revisão de rate limits e revisão OWASP ASVS;
- favoritos, avaliações e demais etapas ainda não implementadas.

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
