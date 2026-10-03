# Runbook de produção

Este documento orienta backup, migrations, restore e rollback da Soravi em
produção. Ele é um procedimento operacional: execute uma etapa por vez e
registre o resultado antes de avançar.

## Escopo e estado atual

- Banco PostgreSQL de produção no Render: `soravi-postgres-production`.
- Plano atual do banco: Basic-256mb.
- PITR (Point-in-Time Recovery) está ativo, com janela de recuperação de
  **3 dias**.
- O painel do Render disponibiliza **Restore database** e export lógico
  manual. Os exports são retidos por pelo menos **7 dias**, conforme o painel
  atual.
- A API de produção usa o plano Starter do Render. O Render disponibiliza
  rollback de deploy.
- O frontend é publicado pela Vercel.
- O healthcheck atual de produção é `/api/v1/health`. Após o próximo go-live,
  atualizar o healthcheck do serviço para `/api/v1/health/ready`.
- As notificações do workspace estão configuradas para Email, com padrão
  **Only failure notifications**.

Não registre neste documento, em tickets, commits ou logs credenciais, senhas,
tokens, cookies, URLs privadas de banco ou variáveis de conexão.

## Papéis e regra de decisão

- **Executor:** pessoa que realiza os passos no painel ou terminal.
- **Responsável pela decisão:** fundador/CEO ou pessoa formalmente designada
  como responsável por produção.
- O executor **não decide sozinho** restaurar, promover um banco restaurado ou
  fazer rollback. Registre a autorização explícita antes dessas ações.

## Checklist antes de qualquer migration

1. Confirme que a API e o banco estão saudáveis. No estado atual, valide
   `/api/v1/health`; após o próximo go-live, valide
   `/api/v1/health/ready`.
2. No painel do Render, abra `soravi-postgres-production` e confirme que PITR
   está ativo e indica janela de 3 dias.
3. Crie um **Export manual** no Render antes da migration. Aguarde a criação
   terminar e identifique o export pelo horário, sem copiar dados sensíveis
   para o registro.
4. Registre no ticket/incidente: data e hora com fuso, commit/release alvo,
   migrations esperadas, identificação do export e confirmação de PITR.
5. No ambiente de produção autorizado, execute somente a verificação de
   status:

   ```bash
   npm run prisma:migrate:status --workspace=@soravi/api
   ```

6. Interrompa e peça decisão se houver migration pendente inesperada, status
   divergente, healthcheck não saudável ou export indisponível.

**Nunca use `prisma migrate dev` em produção.** Nunca edite uma migration já
aplicada.

## Aplicar uma migration em produção

1. Confirme que o checklist anterior foi concluído e que há autorização para a
   janela de alteração.
2. Aplique as migrations versionadas:

   ```bash
   npm run prisma:migrate:deploy --workspace=@soravi/api
   ```

3. Registre o resultado do comando sem incluir configuração sensível.
4. Execute novamente:

   ```bash
   npm run prisma:migrate:status --workspace=@soravi/api
   ```

5. Valide o healthcheck de readiness:

   ```text
   GET /api/v1/health/ready
   ```

   Ele deve responder sucesso somente quando API, PostgreSQL e Redis estiverem
   disponíveis. Até o próximo go-live, mantenha também a validação da rota
   atual `/api/v1/health`.
6. Execute um smoke test mínimo e autorizado: abrir o frontend, autenticar com
   conta de teste permitida e verificar uma leitura crítica do fluxo afetado.
   Não use dados de produção além do necessário.
7. Verifique no Render os **Logs**, **Metrics** e **Events** da API e do banco.
   Confirme também que não houve notificação de falha no Email do workspace.

Não altere uma migration já aplicada para tentar corrigir um problema. Crie uma
nova migration forward-safe, após análise e aprovação.

## Backup e export lógico

Crie export lógico manual:

- antes de migrations;
- antes de deploys com risco de alteração de dados;
- antes de uma investigação que possa exigir comparação/restauração;
- quando o responsável pela decisão solicitar uma cópia de segurança pontual.

O export lógico é a referência de curto prazo antes de uma mudança. A retenção
informada pelo painel é de pelo menos 7 dias; confirme-a no momento da ação,
pois políticas do provedor podem mudar. Registre horário e identificação do
export, não seu conteúdo nem informações de conexão.

## Restore seguro

1. Registre o incidente, horário exato, sintoma, commit/release atual,
   migration envolvida e a decisão autorizada.
2. **Nunca teste restore sobre o banco de produção ativo.**
3. No Render, restaure para recurso/banco separado.
4. No banco restaurado, valide schema, tabelas esperadas e dados críticos de
   forma minimizada.
5. Valide autenticação com uma conta de teste autorizada e dados críticos do
   fluxo afetado. Não exponha dados pessoais em evidências ou logs.
6. Compare o resultado com o momento registrado do incidente e documente as
   diferenças conhecidas.
7. Só promova uma restauração ou altere a produção após decisão explícita do
   responsável. A existência de um restore bem-sucedido não autoriza, por si
   só, trocar o banco ativo.

Nesta etapa, o procedimento de restore ainda **não foi testado**. Planeje e
registre um exercício em ambiente separado antes de depender dele em um
incidente real.

## PITR: quando e como decidir

PITR permite recuperar o banco para um ponto anterior no tempo, dentro da
janela atual de 3 dias. Use-o quando o problema for corrupção, exclusão ou
alteração de dados com um horário aproximado conhecido e o export lógico não
for suficiente.

Antes de iniciar PITR:

1. Registre o timestamp exato do incidente, incluindo fuso horário.
2. Defina o último instante conhecido como saudável.
3. Avalie quais gravações legítimas posteriores seriam perdidas.
4. Obtenha autorização explícita do responsável pela decisão.
5. Prefira restaurar para recurso separado e validar antes de qualquer
   promoção, conforme o procedimento de restore.

PITR não substitui export lógico pré-migration, pois sua janela é limitada a 3
dias e uma recuperação pode exigir análise antes da promoção.

## Rollback da aplicação

Se o problema estiver na aplicação, mas o banco estiver íntegro:

1. Registre horário, commit/release atual, último commit/release estável,
   migration aplicada e autorização para rollback.
2. No backend, use o rollback de deploy do Render para voltar ao último release
   estável conhecido.
3. No frontend, use o rollback da Vercel para o último deployment estável
   conhecido.
4. Após o rollback, valide o healthcheck apropriado, smoke test, Logs, Metrics,
   Events e notificações de falha.

Não tente desfazer manualmente uma migration destrutiva como parte do rollback
da aplicação. Uma versão antiga da API pode ser incompatível com um schema mais
novo; a decisão deve considerar essa compatibilidade antes do rollback.

## Rollback de banco

Para problemas de dados ou schema, priorize nesta ordem:

1. interromper a alteração e preservar evidências;
2. avaliar correção por migration nova, forward-safe;
3. usar restore ou PITR em recurso separado para validar a recuperação;
4. promover somente após decisão explícita.

Nunca edite uma migration aplicada e nunca tente reverter manualmente dados ou
schema em produção sem procedimento aprovado. Para migrations destrutivas, a
rota padrão é restore/PITR ou uma correção forward-safe aprovada.

## Pós-recuperação e monitoramento

Após migration, rollback, restore ou PITR:

1. valide `GET /api/v1/health/ready`;
2. enquanto o healthcheck do Render ainda estiver na rota antiga, valide também
   `GET /api/v1/health` e agende a troca para `/api/v1/health/ready` no próximo
   go-live;
3. execute o smoke test autorizado;
4. verifique **Logs**, **Metrics** e **Events** do Render;
5. verifique as notificações Email de falha do workspace;
6. confirme que o comportamento observado corresponde ao esperado;
7. registre horário de normalização, commit/release final, migration final e
   decisão tomada.

## Checklist de incidente

Registre, no mínimo:

- responsável pela decisão de rollback ou recuperação;
- executor;
- horário de início, timestamp do incidente e fuso horário;
- commit/release antes e depois da ação;
- migration envolvida e resultado de `migrate status`;
- identificação e horário do export/backup disponível;
- disponibilidade de PITR e ponto de recuperação escolhido, se usado;
- resultado de healthcheck, smoke test, Logs, Metrics e Events;
- horário de normalização e pendências de acompanhamento.

## Limitações atuais

- PITR possui janela atual de somente 3 dias.
- O restore não foi testado nesta etapa.
- Storage autoscaling está desabilitado; acompanhe capacidade do banco no
  painel do Render.
- Para o MVP, recomenda-se uma única instância da API.
- Lock distribuído permanece pós-MVP. Processamentos baseados em memória
  requerem atenção adicional antes de escalar horizontalmente.
