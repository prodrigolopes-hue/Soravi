import type { Metadata } from "next";

import { ChangePasswordForm } from "../../../components/account/change-password-form";

export const metadata: Metadata = {
  title: "Segurança da conta | Soravi",
  description: "Proteja o acesso à sua conta Soravi.",
};

export default function AccountSecurityRoute() {
  return (
    <main className="bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Conta
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Segurança da conta
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
            Proteja o acesso à Soravi mantendo sua senha atualizada e exclusiva.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-950">Alterar senha</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Informe sua senha atual e escolha uma nova senha para continuar usando sua conta com segurança.
            </p>
          </div>

          <ChangePasswordForm />
        </section>
      </div>
    </main>
  );
}