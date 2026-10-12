import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const journeyItems = [
  "Descreva sua necessidade",
  "Receba propostas",
  "Escolha quem vai realizar o serviço",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-slate-50">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-0 h-72 bg-gradient-to-b from-blue-100/70 to-transparent"
      />

      <div
        className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-28"
      >
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            Soluções para o que você precisa
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Como podemos ajudar você hoje?
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Descreva o que precisa, publique sua solicitação e receba propostas
            de profissionais interessados.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/solicitacoes/nova"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Descrever o que preciso
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>

            <Link
              href="/cadastro"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Criar conta
            </Link>
          </div>

          <ul
            aria-label="Etapas da jornada na Soravi"
            className="mt-8 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-6"
          >
            {journeyItems.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-green-600"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7">
          <div className="rounded-2xl bg-blue-600 p-6 text-white">
            <p className="text-sm font-medium text-blue-100">
              Precisa resolver algo?
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Conte para a Soravi o que aconteceu.
            </h2>
            <p className="mt-3 leading-7 text-blue-100">
              Você cria uma solicitação e profissionais interessados podem
              apresentar propostas.
            </p>
          </div>

          <ol className="mt-5 space-y-3" aria-label="Resumo do processo">
            <li className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              1. Informe a categoria e os detalhes da sua necessidade.
            </li>
            <li className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              2. Revise e publique sua solicitação.
            </li>
            <li className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              3. Analise as propostas que receber.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
