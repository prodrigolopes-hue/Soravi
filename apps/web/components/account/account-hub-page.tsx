"use client";

import { LoaderCircle, LockKeyhole, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { customerProfileActivationUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type AccountCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof UserRound;
};

export function AccountHubPage() {
  const { accessToken, isAuthenticated, isLoading, refreshSession, user } = useAuth();
  const [isActivatingCustomer, setIsActivatingCustomer] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  if (isLoading) {
    return <AccountMessage title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return <AccountMessage title="Entre para acessar sua conta" description="Acesse sua conta Soravi para gerenciar suas informações." action={{ href: "/entrar", label: "Entrar" }} />;
  }

  const cards: AccountCard[] = [
    {
      title: "Meus dados",
      description: "Consulte seus dados pessoais e a situação do telefone.",
      href: "/conta/dados",
      icon: UserRound,
    },
    ...(isProfessional
      ? [{
        title: "Perfil profissional",
        description: "Atualize como seus serviços aparecem na Soravi.",
        href: "/profissional/perfil",
        icon: UserRound,
      }]
      : []),
    ...(isProfessional
      ? [{
        title: "Painel profissional",
        description: "Acompanhe oportunidades, propostas e seus atendimentos.",
        href: "/profissional",
        icon: UserRound,
      }]
      : []),
    ...(isCustomer
      ? [{
        title: "Painel do cliente",
        description: "Crie solicitações e acompanhe seus serviços contratados.",
        href: "/cliente",
        icon: UserRound,
      }]
      : []),
    {
      title: "Telefone",
      description: "Altere ou verifique seu telefone pelo fluxo seguro.",
      href: "/conta/telefone",
      icon: Phone,
    },
    {
      title: "Segurança",
      description: "Atualize sua senha e proteja o acesso à sua conta.",
      href: "/conta/seguranca",
      icon: LockKeyhole,
    },
  ];

  async function activateCustomerProfile(): Promise<void> {
    if (!accessToken || isActivatingCustomer) {
      return;
    }

    setIsActivatingCustomer(true);
    setActivationError(null);

    try {
      const response = await fetch(customerProfileActivationUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload));
      }

      await refreshSession();
    } catch (error: unknown) {
      setActivationError(
        error instanceof Error
          ? error.message
          : "Não foi possível ativar o perfil de cliente agora.",
      );
    } finally {
      setIsActivatingCustomer(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header>
          <p className="font-semibold text-blue-700">Conta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Minha conta</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Gerencie suas informações e a segurança do acesso à Soravi.</p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Configurações da conta">
          {cards.map(({ title, description, href, icon: Icon }) => (
            <Link key={href} href={href} className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-white"><Icon aria-hidden="true" className="size-5" /></span>
              <span><span className="block text-lg font-bold text-slate-950">{title}</span><span className="mt-2 block text-sm leading-6 text-slate-600">{description}</span></span>
            </Link>
          ))}
          {isProfessional && !isCustomer ? <section className="flex min-h-36 flex-col items-start rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm" aria-labelledby="customer-activation-title">
            <span className="text-lg font-bold text-slate-950" id="customer-activation-title">Também quero contratar</span>
            <p className="mt-2 text-sm leading-6 text-slate-600">Contrate outros serviços usando sua conta atual.</p>
            <button type="button" onClick={() => void activateCustomerProfile()} disabled={isActivatingCustomer} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              {isActivatingCustomer ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
              {isActivatingCustomer ? "Ativando perfil..." : "Ativar perfil de cliente"}
            </button>
            {activationError ? <p role="alert" className="mt-3 text-sm text-red-700">{activationError}</p> : null}
          </section> : null}
          {isCustomer && !isProfessional ? <section className="flex min-h-36 flex-col items-start rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm" aria-labelledby="professional-activation-title">
            <span className="text-lg font-bold text-slate-950" id="professional-activation-title">Também quero trabalhar</span>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ative seu perfil profissional usando esta mesma conta.</p>
            <Link href="/conta/ativar-profissional" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Criar perfil profissional</Link>
          </section> : null}
        </section>
      </div>
    </main>
  );
}

function extractErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  return "Não foi possível ativar o perfil de cliente agora.";
}

function AccountMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) {
  return <main className="bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}</section></div></main>;
}
