# Minuta para revisão — não aprovada para publicação

> Documento interno de trabalho. Esta minuta não altera a política de privacidade pública e não representa conclusão de conformidade jurídica. O texto abaixo depende de revisão jurídica, operacional e de aprovação antes de qualquer publicação.
>
> Os dados de identificação e contato abaixo foram fornecidos pelo responsável e não passaram por conferência cadastral independente.

## Texto proposto para revisão

Para analisar a identidade de profissionais, a Soravi pode tratar o CPF, a imagem de um documento de identidade e, quando esse recurso estiver ativado, uma selfie. Esses dados são usados exclusivamente na análise interna de identidade e não são exibidos no perfil público do profissional.

A análise é feita por revisão humana. A Soravi não utiliza reconhecimento facial automatizado nem prova de vida automatizada nesse processo.

A selfie está prevista apenas para novas tentativas de verificação quando o recurso correspondente for ativado. Ela não será exigida retroativamente de identidades que já tenham sido confirmadas pelas regras anteriores.

O acesso administrativo a esses dados é restrito a pessoas autorizadas para a análise. Quando necessário para essa análise, o sistema gera links temporários para a visualização de imagens privadas. A revelação de CPF e a consulta de selfie possuem registro de auditoria. Esta minuta não afirma que toda abertura de documento possui auditoria individual, pois esse comportamento não está confirmado como regra equivalente no serviço atual.

As imagens de documento e selfie são armazenadas no Cloudflare R2. Elas não são disponibilizadas por rota pública, perfil público ou resposta comum da API.

### Retenção operacional proposta: `identity-media-v1`

Esta é uma política operacional proposta, sujeita a revisão antes da ativação. Ela não deve ser interpretada como prazo legal obrigatório.

- Upload órfão: elegível para descarte uma hora após a criação, conforme a rotina já existente para uploads sem associação válida.
- Evidência substituída: elegível sete dias após ser marcada como substituída.
- Tentativa incompleta: elegível trinta dias após o último envio associado à tentativa.
- Tentativa encerrada: elegível noventa dias após a decisão.

Uma evidência não é elegível para descarte enquanto a tentativa estiver em análise ou enquanto houver suspensão ativa do descarte. Os prazos acima indicam o momento de elegibilidade; o processamento pode ocorrer depois, conforme a rotina de descarte e eventuais novas tentativas após falhas.

O descarte das imagens não apaga automaticamente o CPF, decisões, tentativas ou registros de auditoria. A retenção e a eventual eliminação desses registros mínimos precisam de política própria.

No momento, a coleta de selfie e o descarte automatizado de evidências associadas continuam desabilitados. A limpeza de uploads órfãos já existente permanece independente dessa futura ativação.

## Procedimento interno proposto para solicitações de privacidade

Este procedimento é uma proposta para os pedidos recebidos em **soravioficial@outlook.com**. O responsável operacional inicial é **Paulo Rodrigo Lopes**. A rotina de conferir a caixa em todos os dias úteis e registrar os pedidos conforme o procedimento proposto foi aprovada pelo responsável. Essa aprovação é limitada à rotina indicada e não aprova integralmente o procedimento nem estabelece prazo de atendimento.

A responsabilidade poderá ser transferida posteriormente, documentando o novo responsável e a data da transferência.

1. Registrar um protocolo interno com a data de recebimento, tipo de pedido, responsável pelo tratamento e andamento.
2. Confirmar o recebimento ao solicitante, sem prometer prazo enquanto o prazo aplicável não estiver definido e aprovado.
3. Verificar a identidade de forma proporcional ao pedido, preferindo o uso de uma conta autenticada. Como regra, não solicitar CPF completo, imagem de documento ou selfie por e-mail.
4. Não confirmar se uma conta existe antes da verificação de identidade necessária para o pedido.
5. Avaliar pedidos de acesso, correção, exclusão e informações sobre o tratamento de dados, considerando os registros e limitações aplicáveis em cada caso.
6. Distinguir a exclusão de imagens de identidade, a exclusão da conta e a retenção de decisões e auditorias: são operações com efeitos e regras diferentes.
7. Encaminhar pedidos de exclusão para avaliação manual. Ainda não existe um fluxo completo de exclusão de conta.
8. Registrar a decisão e a resposta enviada, sem copiar dados sensíveis que não sejam necessários para atender ou auditar o pedido.
9. Quando houver possível necessidade de preservar imagens de identidade, encaminhar a avaliação ao fluxo existente de suspensão auditada do descarte, antes do início irreversível da exclusão.

## Limites importantes desta minuta

- A política proposta trata somente de imagens de evidência de identidade; não define a retenção de CPF, decisões, tentativas, auditorias ou backups.
- A exclusão física somente deve ser considerada concluída depois de sucesso confirmado pelo armazenamento. Antes disso, o sistema pode bloquear novos links para a evidência e registrar o descarte como pendente.
- Uma suspensão aplicada antes do início irreversível do descarte impede a exclusão. Após esse ponto, o sistema não pode prometer preservação do arquivo e deve informar conflito de forma explícita.
- A localização exibida no painel Cloudflare R2 foi conferida em 03/11/2026: `soravi-service-requests-staging` e `soravi-service-requests-production` constam como **Eastern North America (ENAM)**. Essa verificação não confirma país específico, backups, replicação, recuperação ou adequação jurídica de transferências internacionais.

## Decisões pendentes antes de publicar

O controlador indicado para a versão a revisar é **Soravi Tecnologia e Serviços LTDA.**, CNPJ **69.148.698/0001-93**. **Paulo Rodrigo Lopes** confirmou o acesso à caixa **soravioficial@outlook.com** e a definiu como canal provisório de privacidade.

1. Bases legais aplicáveis e eventual tratamento de dados pessoais sensíveis: definição e revisão jurídica específicas.
2. Retenção do CPF e dos registros mínimos de decisão, tentativa e auditoria: finalidade, prazo, descarte e exceções documentados em política própria.
3. Localização do armazenamento, transferências internacionais e tratamento de backups: validação da configuração efetiva do Cloudflare R2 e dos fornecedores envolvidos, incluindo país específico, replicação e recuperação, sem inferir esses pontos a partir da localização exibida no painel.
4. Procedimento para solicitações dos titulares e exclusão de conta: escopo, verificação de identidade, interação com obrigações de retenção e tratamento de evidências já descartadas ou em descarte.
5. Aprovação operacional para ativar a coleta de selfie e a execução automatizada da política `identity-media-v1`, incluindo monitoramento de falhas e tratamento de retries.
6. Aprovação da política pública de privacidade e do procedimento interno proposto nesta minuta.

## Referências internas consultadas

- Página pública atual de política de privacidade.
- Regras de negócio e backlog de identidade e descarte.
- Serviços de revisão de identidade, descarte de evidências e armazenamento, para confirmar acesso administrativo, URLs temporárias, auditoria e estados de descarte.
