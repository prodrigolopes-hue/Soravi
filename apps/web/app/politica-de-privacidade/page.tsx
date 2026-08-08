import type { Metadata } from "next";

import {
  LegalDocumentLayout,
  LegalSection,
} from "../../components/legal/legal-document-layout";

export const metadata: Metadata = {
  title: "Política de Privacidade | Soravi",
  description:
    "Consulte a versão preliminar da Política de Privacidade da Soravi.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Política de Privacidade"
      description="Entenda como a Soravi pretende utilizar e proteger os dados pessoais dos usuários."
    >
      <p className="mb-6 text-sm text-slate-500">
        Versão 1.0 · Atualizada em 08/08/2026
      </p>
      <LegalSection title="1. Sobre esta política">
        <p>
          Esta Política de Privacidade apresenta, de forma preliminar, como a
          Soravi pretende coletar, utilizar, armazenar, proteger e compartilhar
          dados pessoais.
        </p>

        <p>
          A identificação jurídica completa da empresa responsável pelo
          tratamento será incluída antes da publicação da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados de cadastro">
        <p>A Soravi poderá tratar informações como:</p>

        <ul className="list-disc space-y-2 pl-6">
          <li>nome;</li>
          <li>e-mail;</li>
          <li>telefone;</li>
          <li>senha armazenada de forma protegida;</li>
          <li>tipo de conta;</li>
          <li>cidade ou área de atendimento;</li>
          <li>categorias e descrição profissional.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Dados de utilização da plataforma">
        <p>
          Quando as funcionalidades forem ativadas, também poderão ser
          tratados dados relacionados a:
        </p>

        <ul className="list-disc space-y-2 pl-6">
          <li>solicitações de serviço;</li>
          <li>propostas enviadas e recebidas;</li>
          <li>contratações realizadas;</li>
          <li>mensagens trocadas pelo chat;</li>
          <li>profissionais favoritos;</li>
          <li>avaliações;</li>
          <li>notificações e ações de moderação.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Dados técnicos">
        <p>
          A plataforma poderá registrar informações técnicas necessárias para
          segurança, diagnóstico e funcionamento, como endereço IP, data e
          horário de acesso, navegador, dispositivo e registros de erro.
        </p>

        <p>
          O uso de cookies e ferramentas de análise deverá ser documentado
          antes de sua ativação.
        </p>
      </LegalSection>

      <LegalSection title="5. Cookies e consentimento">
        <p>
          A Soravi utiliza recursos essenciais para o funcionamento do site, como
          manter a navegação segura e oferecer a experiência básica da plataforma.
        </p>

        <p>
          O uso de analytics e dados de navegação somente ocorrerá quando a
          preferência do usuário for aceita. Nenhum script de analytics será
          carregado sem consentimento explícito.
        </p>

        <p>
          Quando o consentimento for aceito, a Soravi pode utilizar métricas de
          navegação para entender o uso da plataforma e melhorar a experiência.
          A preferência é armazenada localmente no navegador, com versão e data
          de atualização, e pode ser alterada a qualquer momento por meio do link
          “Preferências de cookies” presente no rodapé.
        </p>
      </LegalSection>

      <LegalSection title="6. Finalidades">
        <p>Os dados poderão ser utilizados para:</p>

        <ul className="list-disc space-y-2 pl-6">
          <li>criar e administrar contas;</li>
          <li>conectar clientes e profissionais;</li>
          <li>permitir solicitações, propostas e conversas;</li>
          <li>enviar notificações relacionadas à plataforma;</li>
          <li>prevenir fraudes e acessos não autorizados;</li>
          <li>realizar moderação e suporte;</li>
          <li>melhorar a experiência e o desempenho da Soravi;</li>
          <li>cumprir obrigações legais e regulatórias.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Bases legais">
        <p>
          Cada operação de tratamento deverá possuir uma base legal adequada,
          como execução de contrato ou procedimentos preliminares, cumprimento
          de obrigação legal, consentimento ou legítimo interesse, conforme o
          caso.
        </p>

        <p>
          O mapeamento definitivo das bases legais será documentado antes da
          operação em produção.
        </p>
      </LegalSection>

      <LegalSection title="7. Compartilhamento">
        <p>
          Os dados poderão ser compartilhados somente quando necessário com
          fornecedores de infraestrutura, armazenamento, comunicação,
          monitoramento e segurança.
        </p>

        <p>
          Também poderá ocorrer compartilhamento para cumprimento de obrigação
          legal, ordem judicial ou proteção dos direitos e da segurança dos
          usuários.
        </p>
      </LegalSection>

      <LegalSection title="8. Armazenamento e segurança">
        <p>
          A Soravi adotará medidas técnicas e administrativas proporcionais
          aos riscos para proteger os dados contra acesso não autorizado,
          perda, alteração ou divulgação indevida.
        </p>

        <p>
          Senhas não deverão ser armazenadas em texto puro. Os prazos de
          retenção e eliminação serão definidos conforme a finalidade, as
          obrigações legais e a necessidade de defesa de direitos.
        </p>
      </LegalSection>

      <LegalSection title="9. Direitos dos titulares">
        <p>
          O usuário poderá solicitar, conforme as condições da legislação
          aplicável:
        </p>

        <ul className="list-disc space-y-2 pl-6">
          <li>confirmação da existência de tratamento;</li>
          <li>acesso aos dados pessoais;</li>
          <li>correção de dados incompletos ou desatualizados;</li>
          <li>informações sobre compartilhamento;</li>
          <li>anonimização, bloqueio ou eliminação quando cabível;</li>
          <li>revogação do consentimento quando essa for a base utilizada;</li>
          <li>portabilidade, conforme regulamentação aplicável.</li>
        </ul>
      </LegalSection>

      <LegalSection title="10. Canal de privacidade">
        <p>
          O e-mail ou formulário para exercício dos direitos dos titulares será
          definido e incluído antes da publicação da plataforma.
        </p>

        <p>
          Nenhuma solicitação deverá ser enviada para endereços provisórios ou
          não monitorados.
        </p>
      </LegalSection>

      <LegalSection title="11. Atualizações">
        <p>
          Esta política poderá ser atualizada para acompanhar mudanças no
          produto, na legislação ou nas práticas de tratamento de dados.
        </p>

        <p>
          A versão definitiva deverá apresentar sua data de publicação e seu
          histórico de alterações.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}