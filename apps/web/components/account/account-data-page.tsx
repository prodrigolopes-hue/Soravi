"use client";

import { Phone, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "../auth/auth-provider";

export function AccountDataPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/entrar");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <AccountDataMessage title="Carregando seus dados..." />;
  }

  if (!isAuthenticated || !user) {
    return <AccountDataMessage title="Redirecionando para entrar..." />;
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/conta" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          Voltar para conta
        </Link>

        <header className="mt-5">
          <p className="font-semibold text-blue-700">Conta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Meus dados</h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-600">Consulte os dados associados à sua conta Soravi.</p>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="personal-data-title">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <UserRound aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="personal-data-title" className="font-bold text-slate-950">Dados pessoais</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Nome e e-mail são exibidos somente para consulta neste momento.</p>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-slate-200">
            <DataRow label="Nome completo" value={user.name} />
            <DataRow label="E-mail" value={user.email} />
            <DataRow label="Telefone" value={user.phone ?? "Não informado"} valueClassName={user.phone ? undefined : "text-slate-500"} />
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-slate-700">Verificação do telefone</dt>
              <dd className="sm:col-span-2">
                <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold " + (user.phoneVerified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  {user.phoneVerified ? "Telefone verificado" : "Telefone não verificado"}
                </span>
              </dd>
            </div>
          </dl>

          <Link href="/conta/telefone" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-600 px-4 py-2 font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <Phone aria-hidden="true" className="size-5" />
            Alterar telefone
          </Link>
        </section>
      </div>
    </main>
  );
}

function DataRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold text-slate-700">{label}</dt>
      <dd className={"min-w-0 break-words text-sm text-slate-950 sm:col-span-2 " + (valueClassName ?? "")}>{value}</dd>
    </div>
  );
}

function AccountDataMessage({ title, description, action }: { title: string; description?: string; action?: { href: string; label: string } }) {
  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
          {description ? <p className="mt-3 text-slate-600">{description}</p> : null}
          {action ? <Link href={action.href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}
        </section>
      </div>
    </main>
  );
}
