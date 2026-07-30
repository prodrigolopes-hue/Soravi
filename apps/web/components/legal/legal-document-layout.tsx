import { ArrowLeft, FileWarning } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface LegalDocumentLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSection({
  title,
  children,
}: LegalSectionProps) {
  return (
    <section className="border-t border-slate-200 pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold tracking-tight text-slate-950">
        {title}
      </h2>

      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function LegalDocumentLayout({
  title,
  description,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para a página inicial
        </Link>

        <header className="mt-8">
          <p className="font-semibold text-blue-600">Informações jurídicas</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            {description}
          </p>
        </header>

        <div
          role="note"
          className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
        >
          <FileWarning
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />

          <div>
            <p className="font-semibold">Documento preliminar</p>

            <p className="mt-1 text-sm leading-6">
              Este conteúdo está em desenvolvimento e deverá passar por
              validação jurídica antes da publicação da Soravi.
            </p>
          </div>
        </div>

        <article className="mt-8 space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </article>
      </div>
    </main>
  );
}