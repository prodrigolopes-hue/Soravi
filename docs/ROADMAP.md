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
- hardening compatível de dependências concluído em 2026-09-02, reduzindo o baseline de `npm audit --omit=dev` de 14 para 6 vulnerabilidades, sem `npm audit fix --force`; no primeiro patch, a API passou em TypeScript, 62 suítes/678 testes e build; após as atualizações compatíveis do frontend, passaram TypeScript, ESLint e build; após o Prisma 7.10.0, foram validados Prisma Client generation e build da API;
- primeira etapa do hardening HTTP/CSP do frontend concluída em 2026-09-03: remoção de `X-Powered-By`, headers básicos de segurança, HSTS somente em produção e `Content-Security-Policy-Report-Only` sem enforcement; a política explicita API, WebSocket, ViaCEP, Google Analytics e a origin privada R2 das fotos, sem wildcard ou `https:` genérico em `img-src`; testes locais confirmaram fotos, navegação e chat sem novas violações funcionais;
- hardening de `script-src` concluído em 2026-09-04 no commit técnico `40f766f feat(web): adiciona nonce dinamico ao CSP`: nonce imprevisível por requisição propagado internamente ao Next.js e aos scripts renderizados, incluindo os dois `next/script` do Google Analytics; `script-src` sem `'unsafe-inline'`, com nonce e `'strict-dynamic'`; a CSP de production não permite `'unsafe-eval'` e segue exclusivamente Report-Only, sem enforcement. As páginas passaram a ser server-rendered dinamicamente, trade-off de cache/performance a monitorar;
- restrição de estilos concluída no commit técnico `83b25bf feat(web): restringe estilos inline no CSP`: `style-src 'self'`, `style-src-elem 'self'` e `style-src-attr 'unsafe-inline'`; zero tags `<style>` foram encontradas no HTML inicial e DOM observado, enquanto atributos `style=""` gerados em runtime, inclusive pelo Next.js/Next Image, ainda exigem a permissão temporária restrita a atributos. `script-src` e nonce não mudaram;
- Zod sem JIT concluído no commit técnico `c755262 feat(web): configura Zod sem JIT para CSP`: após Report-Only detectar em production local uma tentativa de `'unsafe-eval'` pelo JIT do Zod 4.4.3, `apps/web/lib/zod.ts` passou a configurar `z.config({ jitless: true })` e centralizar imports, sem alterar validações ou permitir `'unsafe-eval'`; a violação anteriormente observada deixou de aparecer em `/solicitacoes/nova`;
- infraestrutura inicial da Meta: número oficial dedicado à Soravi, WABA existente e número registrado na WhatsApp Cloud API.

### Pendente

- dependência externa/pré-beta da Meta: concluir Business Verification quando houver estrutura jurídica adequada e obter permissão para criar o template de autenticação pretendido `codigo_verificacao_soravi` (`AUTHENTICATION`, `pt_BR`, `COPY_CODE`, expiração de 10 minutos); a tentativa atual foi recusada pela Meta por falta de permissão da WABA;
- validar o envio real de OTP, configurar e assinar o webhook e somente então ativar o provider Meta em produção; a integração não está operacional para OTP;
- revisar antes do beta e a cada atualização compatível upstream o risco residual conhecido das 6 vulnerabilidades, concentrado em `deepmerge-ts` 7.1.5 (`@prisma/config`), `mysql2` 3.15.3 (Prisma/tooling; a Soravi usa PostgreSQL) e `postcss` 8.4.31 (interno do Next.js 15.5.25), sem aplicar overrides internos apenas para zerar o `npm audit` sem validação de compatibilidade;
- hardening obrigatório pré-beta ainda pendente: remover futuramente `style-src-attr 'unsafe-inline'`, monitorar o impacto de cache/performance da renderização dinâmica e avaliar CSP bloqueante; revisar XSS, proteção de sessões/tokens, cookies/refresh, os demais controles de rate limit e OWASP ASVS;
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

## Hardening de sessão concluído

O commit `d3f2183 feat(api): centraliza rate limit com Redis` concluiu o storage compartilhado/multi-instância do rate limit. A configuração foi centralizada, `REDIS_URL` tornou-se obrigatória e restrita a `redis://`/`rediss://`, os limites existentes foram preservados e o cadastro público passou a 5 requisições / 15 minutos. Duas aplicações Nest independentes comprovaram o contador compartilhado (`200, 200, 200, 200, 200, 429`); Redis indisponível falhou de forma fechada, sem fallback local. O lifecycle foi validado e `--detectOpenHandles` não encontrou handles Redis. O warning de teardown observado em algumas execuções normais permanece como investigação separada, sem evidência de vazamento Redis e sem uso de `--forceExit`. Não se afirma deploy em produção.

O bloco de moderação administrativa dos commits `fce91dc` e `7f7b5dd` concluiu bloqueio seguro, reativação, frontend `ACTIVE`/`BLOCKED` e revogação de sessões durante o bloqueio, sem afirmar deploy. O commit `020fd3b` concluiu o teste integrado real de concorrência PostgreSQL entre login e bloqueio administrativo, nas duas ordens de aquisição do lock e com contenção confirmada por `pg_blocking_pids()`. ASVS 5.0.0 V7.4.2 permanece **parcialmente tratado**: ainda são necessários fluxos próprios de suspensão, desativação e exclusão/soft-delete que revoguem sessões explicitamente.

O commit `9443580` concluiu também a cobertura integrada PostgreSQL real de login versus confirmação de password reset, nas duas ordens do lock e com contenção confirmada por `pg_backend_pid()` e `pg_blocking_pids()`. O commit `50b0277` concluiu o teste real do limite de cinco sessões sob dois logins concorrentes, incluindo espera de B pelo lock de A, reaplicação da regra após o primeiro commit e desempate determinístico por `createdAt ASC` + `id ASC`. O commit `a36a8a1` concluiu login versus troca autenticada de senha nas duas ordens, elevando a bateria a sete testes PostgreSQL reais. Outros cenários ainda não implementados permanecem pendentes. Isso não altera o estado documentado de ASVS, não declara conformidade geral e não afirma deploy.

Os commits `e4210b9` (cookie de refresh), `e3000fd` (lifetime absoluto de 90 × 24 horas), `14734d3` (rate limit de login/refresh), `eecb5d6` (máximo de 5 sessões simultâneas), `e70392e` (bloqueio de login com credencial desatualizada), `96abdd6` (serialização de refresh entre abas), `fa63449` (histórico de refresh tokens), `0e2b376` (detecção de replay de refresh token), `5d204a0` (política segura de senha no backend), `ce06e44` (formulários alinhados à política), `f8ea104` (troca de senha autenticada no backend) e `777732b` (segurança da conta no frontend) estão concluídos, sem afirmar deploy em produção nem conformidade ASVS geral. ASVS 5.0.0 V6.2.2, V6.2.3, V6.2.4 e V6.2.5 foram tratados. A [política implementada](ARCHITECTURE.md#13-autenticação-e-sessões) centraliza os detalhes e o [changelog](../CHANGELOG.md) registra as validações. As revisões de sessão ainda pendentes referem-se aos controles adicionais do [backlog pré-beta](07-backlog.md#hardening-de-sessão-pré-beta); os demais hardenings registrados permanecem pendentes.
