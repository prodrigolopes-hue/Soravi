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

### Decisões pendentes para dados não apagados com as imagens

Esta tabela descreve o comportamento implementado observado nos modelos e não
equivale a política aprovada de retenção ou eliminação.

| Grupo | Finalidade descrita no projeto | Dados armazenados | Comportamento atual de retenção/exclusão | Decisão pendente e revisão jurídica/privacidade |
| --- | --- | --- | --- | --- |
| CPF e dados cadastrais | Associar a identidade pessoal ao profissional e apoiar a análise interna de identidade. | Envelope de CPF, HMAC do CPF, identificador/chave de HMAC, identificadores de relação e timestamps de criação/atualização. | O descarte de imagens não os apaga. Os modelos relacionados usam relações restritivas; não há regra de exclusão ou retenção própria documentada. | **Pendente de definição**: finalidade, retenção, descarte, exceções e efeito de eventual exclusão de conta. Exige revisão jurídica/privacidade. |
| Tentativas e decisões de validação | Registrar o andamento e o resultado da revisão humana de identidade. | Identificadores de perfil e identidade, status, resultado, indicação de selfie, datas; nas decisões, origem, resultado, código de motivo, versão de critérios, operador, referência de provedor e data. | O descarte de imagens não apaga tentativas nem decisões. Não há política aprovada de retenção ou exclusão para esses registros. | **Pendente de definição**: retenção, eliminação, preservação em pedidos de titulares e tratamento de referências de provedor. Exige revisão jurídica/privacidade. |
| Auditorias de acesso e revelação | Registrar a revelação de CPF e a consulta de selfie por operadores autorizados. | Identificadores de tentativa e operador, ação e data/hora de acesso. | O descarte de imagens não apaga auditorias. Não há regra documentada de exclusão ou retenção própria. A minuta não afirma auditoria individual equivalente para toda abertura de documento. | **Pendente de definição**: retenção, descarte, preservação e escopo de auditoria. Exige revisão jurídica/privacidade. |
| Eventos de suspensão e tarefas de descarte | Controlar a suspensão auditada e a execução operacional do descarte de imagens. | Nos eventos: identificadores de tentativa e operador, ação, motivo e data. Nas tarefas: identificador da evidência, chave do objeto, versão/motivo da política, estado, contagem e agenda de tentativas, timestamps e código interno de falha. | A conclusão do descarte remove a referência da imagem, mas não apaga automaticamente eventos ou tarefas. Não há política aprovada de retenção ou exclusão desses metadados. | **Pendente de definição**: retenção e eliminação dos metadados operacionais, inclusive chaves de objeto, motivos e códigos de falha. Exige revisão jurídica/privacidade. |
| Backups | Não há finalidade ou mecanismo de backup descritos para estes dados nos modelos consultados. | Não documentado. | A minuta não define retenção, eliminação ou restauração de backups; a localização exibida do R2 não confirma backups, replicação ou recuperação. | **Pendente de definição**: existência, escopo, fornecedor, localização, retenção, eliminação e recuperação. Exige revisão jurídica/privacidade; não presumir configuração ou acesso de provedor. |

No momento, a coleta de selfie e o descarte automatizado de evidências associadas continuam desabilitados. A limpeza de uploads órfãos já existente permanece independente dessa futura ativação.

## Procedimento interno proposto para solicitações de privacidade

### Minuta interna — pendente de aprovação e revisão jurídica/privacidade

Este procedimento se aplica a pedidos sobre dados de validação profissional
recebidos em **soravioficial@outlook.com**. O responsável operacional inicial é
**Paulo Rodrigo Lopes**, que confere a caixa em todos os dias úteis. A aprovação
existente limita-se a essa rotina de acompanhamento; não aprova integralmente
esta minuta, não estabelece prazo de atendimento e não autoriza ativação em
produção. A responsabilidade poderá ser transferida posteriormente, com o novo
responsável e a data documentados.

1. **Receber e registrar.** Criar protocolo interno com data de recebimento,
   canal, categoria, responsável pelo tratamento, andamento e referências
   mínimas necessárias. Não copiar para o protocolo ou para e-mails documento,
   selfie, CPF completo, URL temporária, chave de storage ou credenciais.
2. **Confirmar o recebimento.** Responder que o pedido foi recebido e será
   avaliado, sem prometer exclusão imediata, resultado, prazo ou recuperação de
   arquivo já removido.
3. **Verificar a identidade proporcionalmente.** Preferir uma conta autenticada
   e canal seguro. Não solicitar documento, selfie ou CPF completo por e-mail e
   não confirmar a existência de uma conta antes da verificação necessária. Se
   não houver mecanismo seguro implementado para o caso, registrar a limitação,
   interromper o tratamento material do pedido e encaminhar para definição
   operacional e jurídica; não improvisar coleta por e-mail.
4. **Classificar.** Registrar como: acesso/correção; descarte de imagens de
   identidade; exclusão de conta; ou outro pedido de informação/tratamento.
5. **Avaliar escopo e preservação.** Identificar, sem expor o conteúdo, se o
   pedido envolve imagens, CPF, decisões, tentativas, auditorias ou backups.
   Avaliar necessidade de preservação e encaminhar à revisão jurídica quando
   houver dúvida sobre retenção, obrigação aplicável, transferência, backup ou
   conflito. Se for necessário preservar uma imagem antes do início
   irreversível, usar a suspensão auditada de descarte existente.
6. **Executar somente o que é suportado e autorizado.** O descarte automático
   de imagens segue a política operacional quando habilitada; não é uma ordem
   manual de exclusão por pedido. A suspensão pode impedir descarte futuro, mas
   não restaura imagem já removida nem garante interrupção em andamento. Não
   editar o banco diretamente, não excluir objetos manualmente no bucket e não
   criar tarefas por fora do fluxo. Exclusão de conta ainda não possui fluxo
   completo suportado; encaminhar para avaliação manual. CPF, decisões,
   tentativas, auditorias e backups têm retenção distinta e pendente de política
   própria.
7. **Responder e registrar o resultado.** Informar apenas o resultado aprovado
   e suas limitações, sem anexar ou repetir dados sensíveis. Atualizar o
   protocolo com decisão, ação autorizada ou encaminhamento, data e responsável.
8. **Tratar falhas e lacunas.** Para descarte pendente ou `FAILED`, consultar o
   acompanhamento ADMIN e os diagnósticos sanitizados previstos no runbook. Não
   há reprocessamento suportado: registrar a ocorrência e encaminhar para
   produto/engenharia e, quando aplicável, jurídico. Não prometer recuperação,
   reexecução ou exclusão fora dos mecanismos existentes.

Pontos pendentes: aprovação integral deste procedimento; definição do fluxo
seguro de verificação quando a conta autenticada não bastar; regras de
retenção para CPF, decisões, tentativas, auditorias e backups; e definição
jurídica para bases, prazos aplicáveis, transferências e tratamento de pedidos
de exclusão de conta ou de evidências já descartadas/em descarte.

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
