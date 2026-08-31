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
- fundação backend de recuperação e redefinição de senha;
- invalidação de tokens pendentes na troca administrativa de senha.

### Pendente

- provider real de e-mail para recuperação de senha;
- frontend integrado de solicitar e redefinir senha;
- operação da Meta WhatsApp em produção;
- hardening pré-beta de CSP/XSS, cookies, refresh rotation e rate limits;
- favoritos, avaliações e demais etapas ainda não implementadas.
