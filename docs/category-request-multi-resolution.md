# Resolução múltipla de solicitações de categoria

Uma solicitação de categoria pendente pode ser resolvida pelo administrador em uma, duas ou três categorias oficiais. Cada categoria é escolhida explicitamente como uma categoria ativa existente ou criada na própria decisão; não há inferência de especialidade.

`CategoryRequestResolvedCategory` preserva todas as categorias escolhidas. A coluna legada `CategoryRequest.resolvedCategoryId` é mantida com a primeira resolução para consumidores antigos. A migration cria a relação para cada decisão histórica já resolvida.

A decisão usa transação serializável e trava a proteção de categorias do usuário. Antes de gravar, contabiliza categorias oficiais atuais, novas associações efetivas e solicitações pendentes restantes. Se o total exceder três, falha com `PROFESSIONAL_CATEGORY_LIMIT_REACHED` e não persiste categoria, associação ou histórico parcial.

Para corrigir uma categoria já aprovada em produção, crie as categorias sucessoras e trate profissionais e solicitações abertas por decisão operacional separada. Esta entrega não altera categorias existentes, solicitações, links ou dados de produção.
