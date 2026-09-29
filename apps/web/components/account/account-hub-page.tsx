"use client";

import { LockKeyhole, Phone, UserRound } from "lucide-react";
import Link from "next/link";

import { useAuth } from "../auth/auth-provider";

type AccountCard = {
  title: string;
  description: string;
  href: string;
  icon: typeof UserRound;
};

export function AccountHubPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));

  if (isLoading) {
    return <AccountMessage title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return <AccountMessage title="Entre para acessar sua conta" description="Acesse sua conta Soravi para gerenciar suas informações." action={{ href: "/entrar", label: "Entrar" }} />;
  }

  const cards: AccountCard[] = [
    ...(isProfessional
      ? [{
        title: "Perfil profissional",
        description: "Atualize como seus serviços aparecem na Soravi.",
        href: "/profissional/perfil",
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
        </section>
      </div>
    </main>
  );
}

function AccountMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) {
  return <main className="bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-950">{title}</h1>{description ? <p className="mt-3 text-slate-600">{description}</p> : null}{action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}</section></div></main>;
}
