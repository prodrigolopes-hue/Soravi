import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CustomerRegistrationForm } from "../../../components/auth/customer-registration-form";

export const metadata: Metadata = {
  title: "Cadastro de cliente | Soravi",
  description:
    "Crie sua conta de cliente para solicitar serviços na Soravi.",
};

export default function CustomerRegistrationPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para a escolha de conta
          </Link>

          <section
            aria-labelledby="customer-registration-title"
            className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Cadastro protegido
            </div>

            <h1
              id="customer-registration-title"
              className="mt-5 text-3xl font-bold tracking-tight text-slate-950"
            >
              Crie sua conta de cliente
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Preencha seus dados para começar a solicitar serviços e receber
              propostas de profissionais.
            </p>

            <CustomerRegistrationForm />
          </section>
        </div>
      </div>
    </main>
  );
}