import type { Metadata } from "next";

import {
  LegalDocumentLayout,
  LegalSection,
} from "../../components/legal/legal-document-layout";

export const metadata: Metadata = {
  title: "Termos de Uso | Soravi",
  description:
    "Consulte a versão preliminar dos Termos de Uso da plataforma Soravi.",
};

export default function TermsOfUsePage() {
  return (
    <LegalDocumentLayout
      title="Termos de Uso"
      description="Conheça as regras iniciais para utilização da plataforma Soravi."
    >
      <LegalSection title="1. Sobre a Soravi">
        <p>
          A Soravi é uma plataforma criada para conectar pessoas que precisam
          de serviços a profissionais capazes de oferecer soluções.
        </p>

        <p>
          A plataforma poderá permitir a criação de solicitações, o envio de
          propostas, a comparação de profissionais, a comunicação entre os
          usuários e a avaliação dos serviços concluídos.
        </p>
      </LegalSection>

      <LegalSection title="2. Aceitação dos termos">
        <p>
          Ao criar uma conta ou utilizar a plataforma, o usuário declara que
          leu e compreendeu estes Termos de Uso.
        </p>

        <p>
          A versão definitiva deverá informar a idade mínima, os dados
          jurídicos da empresa responsável e as regras completas de
          contratação.
        </p>
      </LegalSection>

      <LegalSection title="3. Cadastro e segurança da conta">
        <p>
          O usuário deverá fornecer informações verdadeiras, completas e
          atualizadas durante o cadastro.
        </p>

        <p>
          Cada pessoa será responsável por proteger sua senha e por informar à
          Soravi caso identifique acesso não autorizado à sua conta.
        </p>

        <p>
          Contas administrativas não poderão ser criadas pelo cadastro
          público.
        </p>
      </LegalSection>

      <LegalSection title="4. Clientes e profissionais">
        <p>
          Clientes poderão publicar solicitações, receber propostas, escolher
          profissionais, conversar e avaliar serviços concluídos.
        </p>

        <p>
          Profissionais poderão apresentar seus serviços, informar categorias
          e áreas de atendimento e enviar propostas para oportunidades
          compatíveis.
        </p>
      </LegalSection>

      <LegalSection title="5. Solicitações e propostas">
        <p>
          As informações publicadas em solicitações e propostas deverão ser
          claras, verdadeiras e relacionadas a serviços permitidos pela
          plataforma.
        </p>

        <p>
          O profissional poderá enviar somente uma proposta por solicitação,
          podendo alterá-la enquanto a oportunidade estiver aberta, conforme
          as regras da plataforma.
        </p>
      </LegalSection>

      <LegalSection title="6. Contratação e comunicação">
        <p>
          Quando o cliente aceitar uma proposta, a solicitação será encerrada
          para novas propostas e o canal de conversa poderá ser liberado.
        </p>

        <p>
          As mensagens poderão ser registradas para segurança, moderação e
          suporte aos usuários.
        </p>
      </LegalSection>

      <LegalSection title="7. Pagamentos">
        <p>
          Na primeira versão da Soravi, pagamentos não serão processados dentro
          da plataforma.
        </p>

        <p>
          As regras finais sobre valores, cobranças, reembolsos e eventuais
          conflitos deverão ser definidas e validadas juridicamente antes do
          lançamento público.
        </p>
      </LegalSection>

      <LegalSection title="8. Condutas proibidas">
        <p>Não será permitido utilizar a Soravi para:</p>

        <ul className="list-disc space-y-2 pl-6">
          <li>publicar informações falsas ou enganosas;</li>
          <li>praticar fraude ou tentar obter vantagem indevida;</li>
          <li>utilizar linguagem ofensiva, discriminatória ou ameaçadora;</li>
          <li>publicar conteúdo ilegal ou inadequado;</li>
          <li>tentar acessar contas, dados ou sistemas sem autorização;</li>
          <li>prejudicar a segurança ou o funcionamento da plataforma.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Moderação">
        <p>
          A Soravi poderá analisar denúncias, remover conteúdos, limitar
          funcionalidades ou bloquear contas que violem as regras da
          plataforma.
        </p>

        <p>
          Os critérios de notificação, defesa e recurso deverão ser detalhados
          na versão jurídica definitiva.
        </p>
      </LegalSection>

      <LegalSection title="10. Responsabilidades">
        <p>
          A redação definitiva sobre responsabilidades da Soravi, dos clientes
          e dos profissionais será definida antes do lançamento.
        </p>

        <p>
          Essa seção deverá passar por revisão jurídica específica e não deve
          ser publicada em produção no formato atual.
        </p>
      </LegalSection>

      <LegalSection title="11. Contato">
        <p>
          O canal oficial para dúvidas jurídicas e solicitações relacionadas a
          estes termos será informado antes da publicação da plataforma.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}