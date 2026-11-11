import {
  ClipboardList,
  FileCheck2,
  MessagesSquare,
  UserRoundCheck,
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
    title: "Publique sua solicitação",
    description:
      "Revise as informações e publique para que profissionais compatíveis possam receber a oportunidade.",
    icon: FileCheck2,
  },
  {
    number: "03",
    title: "Receba propostas",
    description:
      "Profissionais interessados podem enviar valor, prazo estimado e uma mensagem.",
    icon: MessagesSquare,
  },
  {
    number: "04",
    title: "Escolha um profissional",
    description:
      "Analise as propostas recebidas, aceite a que fizer sentido e continue a conversa pela plataforma.",
    icon: UserRoundCheck,
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="how-it-works-title"
      className="relative isolate overflow-hidden scroll-mt-20 bg-slate-50 py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/70 via-slate-50/40 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute -left-28 top-32 -z-10 size-80 rounded-full border-[28px] border-blue-100/40"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 bottom-0 -z-10 size-72 rounded-tl-[9rem] bg-blue-100/30"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
            Como funciona
          </p>
          <h2
            id="how-it-works-title"
            className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Da necessidade à solução em poucos passos
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            A Soravi facilita o contato entre quem precisa de ajuda e quem sabe
            resolver.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {steps.map(({ number, title, description, icon: Icon }, index) => (
            <li key={number} className="relative min-w-0">
              <article className="relative flex h-full flex-col items-center rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_12px_30px_-18px_rgba(15,23,42,0.28)] sm:p-7">
                <span className="absolute left-5 top-5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold tracking-wide text-blue-700">
                  {number}
                </span>
                <div className="flex size-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-sm">
                  <Icon aria-hidden="true" className="size-8" strokeWidth={2.2} />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-950">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              </article>

              {index < steps.length - 1 ? (
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[calc(100%+0.15rem)] top-7 z-10 hidden h-16 w-6 overflow-visible lg:block"
                  fill="none"
                  viewBox="0 0 28 64"
                >
                  <path
                    d="M1 31C8 16 18 16 24 31"
                    stroke="currentColor"
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                    strokeWidth="2"
                    className="text-blue-500"
                  />
                  <path
                    d="m20 27 5 4-5 4"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="text-blue-500"
                  />
                </svg>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
