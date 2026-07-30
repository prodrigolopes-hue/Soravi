import type { Metadata } from "next";
import {
  BriefcaseBusiness,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { AccountTypeCard } from "../../components/auth/account-type-card";

export const metadata: Metadata = {
  title: "Criar conta | Soravi",
  description:
    "Escolha como deseja utilizar a Soravi e comece seu cadastro.",
};

const accountTypes = [
  {
    title: "Quero contratar um serviço",
    description:
      "Crie uma conta de cliente para publicar solicitações e encontrar profissionais.",
    href: "/cadastro/cliente",
    actionLabel: "Continuar como cliente",
    icon: UserRound,
    variant: "client" as const,
    benefits: [
      "Criar solicitações de serviço",
      "Receber e comparar propostas",
      "Conversar com profissionais",
    ],
  },
  {
    title: "Quero oferecer meus serviços",
    description:
      "Crie um perfil profissional para encontrar oportunidades e apresentar propostas.",
    href: "/cadastro/profissional",
    actionLabel: "Continuar como profissional",
    icon: BriefcaseBusiness,
    variant: "professional" as const,
    benefits: [
      "Encontrar novas oportunidades",
      "Enviar propostas aos clientes",
      "Construir sua reputação",
    ],
  },
] as const;

export default function RegisterPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold text-blue-600">Criar uma conta</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Como você deseja usar a Soravi?
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            Escolha a opção que melhor representa o que você precisa neste
            momento.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {accountTypes.map((accountType) => (
            <AccountTypeCard
              key={accountType.href}
              title={accountType.title}
              description={accountType.description}
              href={accountType.href}
              actionLabel={accountType.actionLabel}
              benefits={accountType.benefits}
              icon={accountType.icon}
              variant={accountType.variant}
            />
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-green-600"
          />

          <p className="text-sm leading-6 text-slate-600">
            Seus dados serão utilizados apenas para a operação e a segurança
            da plataforma, conforme nossa futura Política de Privacidade.
          </p>
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          Já possui uma conta?{" "}
          <Link
            href="/entrar"
            className="font-semibold text-blue-600 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}