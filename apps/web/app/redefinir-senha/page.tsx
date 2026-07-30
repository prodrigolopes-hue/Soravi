import type { Metadata } from "next";
import { KeyRound, ShieldCheck } from "lucide-react";

import { ResetPasswordForm } from "../../components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha | Soravi",
  description: "Crie uma nova senha para sua conta Soravi.",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{
    token?: string | string[];
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token } = await searchParams;

  const receivedToken = Array.isArray(token) ? token[0] : token;

  const validToken =
    typeof receivedToken === "string" &&
    receivedToken.trim().length > 0
      ? receivedToken
      : null;

  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
        <section
          aria-labelledby="reset-password-title"
          className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <KeyRound aria-hidden="true" className="size-7" />
          </div>

          <h1
            id="reset-password-title"
            className="mt-6 text-3xl font-bold tracking-tight text-slate-950"
          >
            Crie uma nova senha
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Escolha uma senha segura e diferente das utilizadas anteriormente.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-green-50 p-4 text-sm leading-6 text-green-800">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0"
            />

            <p>
              A Soravi nunca solicitará sua senha por mensagem, telefone ou
              e-mail.
            </p>
          </div>

          <ResetPasswordForm token={validToken} />
        </section>
      </div>
    </main>
  );
}