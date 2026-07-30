import type { Metadata } from "next";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ProfessionalRegistrationForm } from "../../../components/auth/professional-registration-form";

export const metadata: Metadata = {
  title: "Cadastro profissional | Soravi",
  description:
    "Crie seu perfil profissional e encontre oportunidades na Soravi.",
};

export default function ProfessionalRegistrationPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para a escolha de conta
          </Link>

          <section
            aria-labelledby="professional-registration-title"
            className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
          >
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                <BriefcaseBusiness aria-hidden="true" className="size-4" />
                Perfil profissional
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                <ShieldCheck aria-hidden="true" className="size-4" />
                Cadastro protegido
              </div>
            </div>

            <h1
              id="professional-registration-title"
              className="mt-5 text-3xl font-bold tracking-tight text-slate-950"
            >
              Crie sua conta profissional
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Apresente seus serviços, informe sua área de atendimento e
              prepare seu perfil para encontrar novas oportunidades.
            </p>

            <ProfessionalRegistrationForm />
          </section>
        </div>
      </div>
    </main>
  );
}