import {
  CheckCircle2,
  ClipboardList,
  MessagesSquare,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

interface Step {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const steps: Step[] = [
  {
    number: "01",
    title: "Descreva sua necessidade",
    description:
      "Conte o que precisa, informe a categoria e adicione os detalhes importantes.",
    icon: ClipboardList,
  },
  {
    number: "02",
    title: "Receba propostas",
    description:
      "Profissionais interessados podem enviar valor, prazo e uma mensagem.",
    icon: MessagesSquare,
  },
  {
    number: "03",
    title: "Compare profissionais",
    description:
      "Analise as propostas, os perfis e as avaliações antes de decidir.",
    icon: UsersRound,
  },
  {
    number: "04",
    title: "Escolha com segurança",
    description:
      "Aceite a melhor proposta e continue a conversa pela plataforma.",
    icon: CheckCircle2,
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="bg-slate-50 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold text-blue-600">Como funciona</p>

          <h2
            id="how-it-works-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Da necessidade à solução em poucos passos
          </h2>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            A Soravi facilita o contato entre quem precisa de ajuda e quem sabe
            resolver.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ number, title, description, icon: Icon }) => (
            <li
              key={number}
              className="relative rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="text-sm font-bold text-blue-600">{number}</span>

              <div className="mt-5 flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon aria-hidden="true" className="size-6" />
              </div>

              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}