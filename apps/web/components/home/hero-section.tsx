import { ArrowRight, CheckCircle2 } from "lucide-react";
import Image from "next/image";
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
        className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:px-8 lg:py-20"
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

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <Image
            src="/images/soravi-hero-cliente-profissional.webp"
            alt="Cliente cumprimenta profissional de serviços em uma residência"
            width={1200}
            height={800}
            priority
            sizes="(max-width: 1023px) calc(100vw - 2rem), (max-width: 1279px) 52vw, 680px"
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
