"use client";

import { Phone, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { personalIdentityStatusUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

type PersonalIdentityStatus =
  | { kind: "loading"; sessionKey: string }
  | { kind: "recorded"; sessionKey: string; recorded: boolean }
  | { kind: "error"; sessionKey: string };

export function AccountDataPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const sessionKey = useMemo(
    () => `${user?.id ?? ""}:${accessToken ?? ""}`,
    [accessToken, user?.id],
  );
  const [personalIdentityStatus, setPersonalIdentityStatus] =
    useState<PersonalIdentityStatus>({ kind: "loading", sessionKey: "" });
  const activeStatusSessionKey = useRef<string | null>(null);

  if (isLoading || !isAuthenticated || !user || !accessToken) {
    activeStatusSessionKey.current = null;
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/entrar");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || !accessToken) return;

    const controller = new AbortController();
    let isCurrent = true;
    const requestSessionKey = sessionKey;
    activeStatusSessionKey.current = requestSessionKey;
    setPersonalIdentityStatus({ kind: "loading", sessionKey: requestSessionKey });

    void fetch(personalIdentityStatusUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Personal identity status request failed.");
        const payload: unknown = await response.json();
        if (!isPersonalIdentityStatusResponse(payload)) {
          throw new Error("Invalid personal identity status response.");
        }
        return payload;
      })
      .then((payload) => {
        if (isCurrent) {
          setPersonalIdentityStatus({ kind: "recorded", sessionKey: requestSessionKey, recorded: payload.recorded });
        }
      })
      .catch(() => {
        if (isCurrent && !controller.signal.aborted) {
          setPersonalIdentityStatus({ kind: "error", sessionKey: requestSessionKey });
        }
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [accessToken, isAuthenticated, isLoading, refreshAttempt, sessionKey, user]);

  if (isLoading) {
    return <AccountDataMessage title="Carregando seus dados..." />;
  }

  if (!isAuthenticated || !user) {
    return <AccountDataMessage title="Redirecionando para entrar..." />;
  }

  const visiblePersonalIdentityStatus =
    activeStatusSessionKey.current === sessionKey &&
    personalIdentityStatus.sessionKey === sessionKey
      ? personalIdentityStatus
      : { kind: "loading" as const, sessionKey };

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
            <div className="grid gap-2 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-semibold text-slate-700">Verificação do e-mail</dt>
              <dd className="sm:col-span-2">
                <span className={"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold " + (user.emailVerified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  {user.emailVerified ? "E-mail verificado" : "E-mail pendente de verificação"}
                </span>
                {!user.emailVerified ? <Link href="/verificar-email" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Verificar e-mail</Link> : null}
              </dd>
            </div>
            <DataRow label="Telefone" value={user.phone ?? "Não informado"} valueClassName={user.phone ? undefined : "text-slate-500"} />
            <PersonalIdentityStatusRow
              status={visiblePersonalIdentityStatus}
              onRetry={() => setRefreshAttempt((attempt) => attempt + 1)}
            />
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

function PersonalIdentityStatusRow({
  status,
  onRetry,
}: {
  status: PersonalIdentityStatus;
  onRetry: () => void;
}) {
  let content: ReactNode;

  if (status.kind === "loading") {
    content = <span className="text-slate-600">Consultando cadastro do CPF...</span>;
  } else if (status.kind === "recorded") {
    content = (
      <span className={status.recorded ? "font-semibold text-emerald-800" : "text-slate-600"}>
        {status.recorded ? "CPF cadastrado" : "CPF não informado"}
      </span>
    );
  } else {
    content = (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-700">Não foi possível consultar o cadastro do CPF.</span>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold text-slate-700">CPF</dt>
      <dd className="min-w-0 text-sm sm:col-span-2" aria-live="polite">
        {content}
      </dd>
    </div>
  );
}

function isPersonalIdentityStatusResponse(
  value: unknown,
): value is { recorded: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    "recorded" in value &&
    typeof value.recorded === "boolean"
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
