import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { LaunchInterestForm } from "../components/launch/launch-interest-form";
import { ServiceCategories } from "../components/home/service-categories";

export const metadata: Metadata = {
  title: "Soravi — Em breve",
  description:
    "A Soravi está chegando para conectar pessoas a profissionais e soluções de serviços com confiança, proximidade e simplicidade.",
};

export default function HomePage() {
  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-8">
          <span className="inline-flex rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Lançamento em breve
          </span>

          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Como podemos ajudar você hoje?
            </h1>

            <p className="max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
              A Soravi está chegando para conectar pessoas a profissionais e
              soluções de serviços com confiança, proximidade e simplicidade.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#acompanhe-lancamento"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Acompanhe o lançamento
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>

            <p className="max-w-xl text-sm text-slate-600">
              Fique por dentro do lançamento e saiba como a Soravi vai conectar
              talento e demanda.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="relative w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 shadow-sm">
            <div className="relative aspect-[4/3] sm:aspect-[16/10]">
              <Image
                src="/images/soravi-hero-coming-soon.png"
                alt="Ilustração de cliente e profissional conectados na Soravi"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section id="acompanhe-lancamento" className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto max-w-4xl">
          <LaunchInterestForm />
        </div>
      </section>

      <ServiceCategories />

      <section className="mt-10 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Quem se beneficia
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            A Soravi nasce para aproximar clientes que precisam de serviços e
            profissionais que querem oportunidades.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-950">
              <Sparkles className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Clientes</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Encontre serviços e profissionais confiáveis com agilidade,
              clareza e apoio durante todo o processo.
            </p>
          </article>

          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-950">
              <ShieldCheck
                className="h-5 w-5 text-emerald-600"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold">Profissionais</h3>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Conecte-se a clientes que buscam sua expertise e cresça sua
              carteira de trabalho com mais segurança.
            </p>
          </article>
        </div>
      </section>

      <section
        id="pilares"
        className="mt-16 rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-10"
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Pilares da Soravi
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Conexões construídas em valores claros.
          </h2>

          <p className="mt-5 text-base leading-7 text-slate-300">
            Uma plataforma pensada para facilitar, proteger e ampliar as
            oportunidades de quem busca ou oferece serviços.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl bg-slate-900/90 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold text-white">Simplicidade</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Encontre ou ofereça serviços sem complicação, com uma
                experiência clara e acolhedora.
              </p>
            </article>

            <article className="rounded-3xl bg-slate-900/90 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold text-white">Confiança</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Uma experiência pensada para relações mais seguras entre
                clientes e profissionais.
              </p>
            </article>

            <article className="rounded-3xl bg-slate-900/90 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-semibold text-white">
                Oportunidades
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Conexão entre quem precisa e quem sabe fazer, criando
                oportunidades reais para todos.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
