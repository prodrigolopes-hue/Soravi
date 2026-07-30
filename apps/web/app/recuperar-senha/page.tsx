import type { Metadata } from "next";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ForgotPasswordForm } from "../../components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar senha | Soravi",
  description:
    "Solicite as instruções para recuperar o acesso à sua conta Soravi.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <div className="w-full max-w-md">
          <Link
            href="/entrar"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar para entrar
          </Link>

          <section
            aria-labelledby="forgot-password-title"
            className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <KeyRound aria-hidden="true" className="size-7" />
            </div>

            <h1
              id="forgot-password-title"
              className="mt-6 text-3xl font-bold tracking-tight text-slate-950"
            >
              Recupere sua senha
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Informe o e-mail da sua conta para receber as instruções de
              recuperação.
            </p>

            <div className="mt-5 flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-800">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />

              <p>
                Por segurança, a Soravi não deverá informar se um determinado
                e-mail possui ou não uma conta cadastrada.
              </p>
            </div>

            <ForgotPasswordForm />
          </section>
        </div>
      </div>
    </main>
  );
}