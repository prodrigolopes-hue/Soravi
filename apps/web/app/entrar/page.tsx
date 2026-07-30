import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { LoginForm } from "../../components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar | Soravi",
  description: "Entre na sua conta da Soravi.",
};

const benefits = [
  "Acompanhe suas solicitações",
  "Converse com profissionais",
  "Compare e aceite propostas",
] as const;

export default function LoginPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-20">
        <section
          aria-labelledby="login-benefits-title"
          className="hidden lg:block"
        >
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Sua jornada continua com segurança
            </div>

            <h2
              id="login-benefits-title"
              className="mt-6 text-4xl font-bold tracking-tight text-slate-950"
            >
              Acesse sua conta e encontre a solução que procura.
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Entre para acompanhar suas solicitações, propostas e conversas
              em um só lugar.
            </p>

            <ul className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-center gap-3 text-slate-700"
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-5 shrink-0 text-green-600"
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="login-title"
          className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8"
        >
          <p className="font-semibold text-blue-600">Bem-vindo de volta</p>

          <h1
            id="login-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
          >
            Entre na sua conta
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Use seu e-mail e sua senha para acessar a Soravi.
          </p>

          <LoginForm />
        </section>
      </div>
    </main>
  );
}