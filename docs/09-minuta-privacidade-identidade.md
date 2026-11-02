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

## Limites importantes desta minuta

- A política proposta trata somente de imagens de evidência de identidade; não define a retenção de CPF, decisões, tentativas, auditorias ou backups.
- A exclusão física somente deve ser considerada concluída depois de sucesso confirmado pelo armazenamento. Antes disso, o sistema pode bloquear novos links para a evidência e registrar o descarte como pendente.
- Uma suspensão aplicada antes do início irreversível do descarte impede a exclusão. Após esse ponto, o sistema não pode prometer preservação do arquivo e deve informar conflito de forma explícita.
- A configuração de região, transferências internacionais, cópias de segurança e prazos de recuperação do armazenamento não foi confirmada nesta minuta.

## Decisões pendentes antes de publicar

O controlador indicado para a versão a revisar é **Soravi Tecnologia e Serviços LTDA.**, CNPJ **69.148.698/0001-93**. O canal provisório de privacidade indicado é **soravioficial@outlook.com**.

1. Confirmar que a caixa provisória de privacidade é monitorada, definir o responsável operacional e estabelecer o fluxo para pedidos de titulares.
2. Bases legais aplicáveis e eventual tratamento de dados pessoais sensíveis: definição e revisão jurídica específicas.
3. Retenção do CPF e dos registros mínimos de decisão, tentativa e auditoria: finalidade, prazo, descarte e exceções documentados em política própria.
4. Localização do armazenamento, transferências internacionais e tratamento de backups: validação da configuração efetiva do Cloudflare R2 e dos fornecedores envolvidos, sem pressupor região, replicação ou recuperação.
5. Procedimento para solicitações dos titulares e exclusão de conta: escopo, verificação de identidade, interação com obrigações de retenção e tratamento de evidências já descartadas ou em descarte.
6. Aprovação operacional para ativar a coleta de selfie e a execução automatizada da política `identity-media-v1`, incluindo monitoramento de falhas e tratamento de retries.

## Referências internas consultadas

- Página pública atual de política de privacidade.
- Regras de negócio e backlog de identidade e descarte.
- Serviços de revisão de identidade, descarte de evidências e armazenamento, para confirmar acesso administrativo, URLs temporárias, auditoria e estados de descarte.
