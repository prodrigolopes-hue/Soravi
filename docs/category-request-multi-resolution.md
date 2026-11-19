# Resolução múltipla de solicitações de categoria

Uma solicitação de categoria pendente pode ser resolvida pelo administrador em uma, duas ou três categorias oficiais. Cada categoria é escolhida explicitamente como uma categoria ativa existente ou criada na própria decisão; não há inferência de especialidade.

`CategoryRequestResolvedCategory` preserva todas as categorias escolhidas. A coluna legada `CategoryRequest.resolvedCategoryId` é mantida com a primeira resolução para consumidores antigos. A migration cria a relação para cada decisão histórica já resolvida.

A decisão usa transação serializável e trava a proteção de categorias do usuário. Antes de gravar, contabiliza categorias oficiais atuais, novas associações efetivas e solicitações pendentes restantes. Se o total exceder dez, falha com `PROFESSIONAL_CATEGORY_LIMIT_REACHED` e não persiste categoria, associação ou histórico parcial.

Para corrigir uma categoria já aprovada em produção, crie as categorias sucessoras e trate profissionais e solicitações abertas por decisão operacional separada. Esta entrega não altera categorias existentes, solicitações, links ou dados de produção.

## Validação local da migration

Em 17/11/2026, a migration `20261116000100_add_category_request_multi_resolution` foi aplicada com sucesso somente no banco local descartável `soravi_migration_bootstrap_test`, em `localhost:55432`, após o bootstrap histórico controlado. Sete testes unitários, seis testes de integração PostgreSQL e os builds da API e do site foram aprovados. A suíte de integração confirmou o backfill de uma resolução legada, decisão real com categoria existente e nova, limite de três com rollback, ordens consecutivas para categorias novas e concorrência sem persistência parcial.

Essa evidência não afirma execução em staging nem produção. Nenhuma categoria, solicitação ou vínculo de produção foi alterado.

Categorias novas criadas pela decisão recebem `displayOrder` igual à maior posição existente mais um. A decisão que pode criar categoria adquire um advisory lock transacional antes da primeira leitura; criações simultâneas recebem snapshots e posições distintos. Categorias já existentes não são reordenadas por esta entrega; uma correção histórica deve ser feita por operação administrativa aprovada, com inventário e plano de ordenação explícitos.

Na administração, “Resolver em várias” abre um diálogo que pesquisa categorias oficiais ativas pelo nome ou slug, permite adicionar novas por nome e slug opcional, revisar ou remover escolhas e registrar nota opcional. O diálogo mostra o limite de três e apresenta o erro retornado pela decisão; os fluxos separados de criar, associar e recusar permanecem inalterados.
