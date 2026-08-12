"use client";

import { ArrowRight, Clock3, FolderSearch, Shield, Users, Wrench } from "lucide-react";
import Link from "next/link";

import { useAuth } from "../auth/auth-provider";

type AdminModule = {
  title: string;
  description: string;
  status: string;
  href?: string;
  icon: typeof FolderSearch;
  tone: "available" | "soon";
};

const adminModules: AdminModule[] = [
  {
    title: "Interessados",
    description: "Acompanhe os contatos recebidos no lançamento.",
    status: "Disponível",
    href: "/admin/interessados",
    icon: FolderSearch,
    tone: "available",
  },
  {
    title: "Clientes",
    description: "Gestão das contas de clientes.",
    status: "Em breve",
    icon: Users,
    tone: "soon",
  },
  {
    title: "Profissionais",
    description: "Gestão, verificação e acompanhamento de profissionais.",
    status: "Em breve",
    icon: Shield,
    tone: "soon",
  },
  {
    title: "Categorias",
    description: "Gestão das categorias de serviços.",
    status: "Em breve",
    icon: Wrench,
    tone: "soon",
  },
  {
    title: "Moderação",
    description: "Ocorrências, suspensões e revisão administrativa.",
    status: "Em breve",
    icon: Clock3,
    tone: "soon",
  },
] as const;

function ModuleCard({ module }: { module: AdminModule }) {
  const Icon = module.icon;
  const cardClassName = module.href
    ? "flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 sm:p-7"
    : "flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7";

  const content = (
    <article className={cardClassName}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon aria-hidden="true" className="size-5" />
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            module.tone === "available"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {module.status}
        </span>
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
        {module.title}
      </h3>

      <p className="mt-3 flex-1 leading-7 text-slate-600">
        {module.description}
      </p>

      {module.href ? (
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
          Acessar módulo
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      ) : (
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
          Em breve
        </span>
      )}
    </article>
  );

  if (module.href) {
    return (
      <Link
        href={module.href}
        className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export function AdminDashboardPage() {
  const { isLoading, isAuthenticated, user } = useAuth();

  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  if (isLoading) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" aria-live="polite">
            <p className="text-sm font-medium text-slate-700">Carregando painel administrativo...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8" aria-labelledby="admin-signin-title">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
              Área administrativa
            </p>
            <h1 id="admin-signin-title" className="mt-3 text-2xl font-bold tracking-tight text-amber-950 sm:text-3xl">
              Entre para acessar o painel administrativo.
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-amber-900/80">
              Faça login com uma conta autorizada para acompanhar os módulos administrativos da Soravi.
            </p>
            <Link
              href="/entrar"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Entrar
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-red-200 bg-red-50 p-8" role="alert" aria-labelledby="admin-forbidden-title">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">
              Área administrativa
            </p>
            <h1 id="admin-forbidden-title" className="mt-3 text-2xl font-bold tracking-tight text-red-950 sm:text-3xl">
              Acesso não autorizado
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-red-900/80">
              Sua conta não possui permissão para visualizar este painel.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
            Painel administrativo
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Painel administrativo
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Uma visão central da operação da Soravi.
          </p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Módulos administrativos">
          {adminModules.map((module) => (
            <ModuleCard key={module.title} module={module} />
          ))}
        </section>
      </div>
    </main>
  );
}