"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { launchInterestsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

const PAGE_SIZE = 20;

interface LaunchInterest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  audienceType: string;
  city: string;
  state: string | null;
  serviceInterest: string | null;
  professionalCategoryInterest: string | null;
  source: string;
  privacyNoticeAcceptedAt: string;
  marketingConsentAt: string | null;
  emailConfirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LaunchInterestPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface LaunchInterestApiResponse {
  items: LaunchInterest[];
  pagination: LaunchInterestPagination;
}

type RequestState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function parseLaunchInterest(value: unknown): LaunchInterest | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate: Partial<LaunchInterest> = value;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.email !== "string" ||
    !isNullableString(candidate.phone) ||
    typeof candidate.audienceType !== "string" ||
    typeof candidate.city !== "string" ||
    !isNullableString(candidate.state) ||
    !isNullableString(candidate.serviceInterest) ||
    !isNullableString(candidate.professionalCategoryInterest) ||
    typeof candidate.source !== "string" ||
    typeof candidate.privacyNoticeAcceptedAt !== "string" ||
    !isNullableString(candidate.marketingConsentAt) ||
    !isNullableString(candidate.emailConfirmedAt) ||
    !isNullableString(candidate.unsubscribedAt) ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    audienceType: candidate.audienceType,
    city: candidate.city,
    state: candidate.state,
    serviceInterest: candidate.serviceInterest,
    professionalCategoryInterest: candidate.professionalCategoryInterest,
    source: candidate.source,
    privacyNoticeAcceptedAt: candidate.privacyNoticeAcceptedAt,
    marketingConsentAt: candidate.marketingConsentAt,
    emailConfirmedAt: candidate.emailConfirmedAt,
    unsubscribedAt: candidate.unsubscribedAt,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function parsePagination(value: unknown): LaunchInterestPagination | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate: Partial<LaunchInterestPagination> = value;
  const page = candidate.page;
  const pageSize = candidate.pageSize;
  const total = candidate.total;
  const totalPages = candidate.totalPages;

  if (
    !isPositiveInteger(page) ||
    !isPositiveInteger(pageSize) ||
    typeof total !== "number" ||
    !Number.isInteger(total) ||
    total < 0 ||
    typeof totalPages !== "number" ||
    !Number.isInteger(totalPages) ||
    totalPages < 0
  ) {
    return null;
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
}

function parseLaunchInterestApiResponse(payload: unknown): LaunchInterestApiResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items)) {
    return null;
  }

  const items: LaunchInterest[] = [];

  for (const item of root.items) {
    const parsedItem = parseLaunchInterest(item);

    if (!parsedItem) {
      return null;
    }

    items.push(parsedItem);
  }

  const pagination = parsePagination(root.pagination);

  if (!pagination) {
    return null;
  }

  return {
    items,
    pagination,
  };
}

function formatAudienceType(value: string): string {
  if (value === "CUSTOMER") {
    return "Cliente";
  }

  if (value === "PROFESSIONAL") {
    return "Profissional";
  }

  if (value === "BOTH") {
    return "Cliente e profissional";
  }

  return value;
}

function formatSource(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatCityState(city: string, state: string | null): string {
  if (!state || state.trim().length === 0) {
    return city;
  }

  return `${city}/${state}`;
}

function formatInterest(item: LaunchInterest): string {
  const values = [item.serviceInterest, item.professionalCategoryInterest]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  if (values.length === 0) {
    return "Não informado";
  }

  return values.join(" · ");
}

function formatRegistrationDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMarketingStatus(item: LaunchInterest): string {
  if (item.unsubscribedAt !== null) {
    return "Descadastrado";
  }

  if (item.marketingConsentAt !== null) {
    return "Aceito";
  }

  return "Não aceito";
}

function buildErrorMessage(state: RequestState): string {
  if (state === "unauthorized") {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  if (state === "forbidden") {
    return "Acesso não autorizado para visualizar os interessados do lançamento.";
  }

  return "Não foi possível carregar os interessados agora. Tente novamente.";
}

export function LaunchInterestsPage() {
  const { isLoading, isAuthenticated, accessToken, user } = useAuth();

  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<LaunchInterestApiResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");

  const isAdmin = useMemo(() => {
    if (!user) {
      return false;
    }

    return user.roles.includes("ADMIN");
  }, [user]);

  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  const fetchLaunchInterests = useCallback(
    async (targetPage: number): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setRequestState("loading");

      try {
        const url = new URL(launchInterestsUrl);
        url.searchParams.set("page", String(targetPage));
        url.searchParams.set("pageSize", String(PAGE_SIZE));

        const httpResponse = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
          cache: "no-store",
        });

        if (httpResponse.status === 401) {
          setResponse(null);
          setRequestState("unauthorized");
          return;
        }

        if (httpResponse.status === 403) {
          setResponse(null);
          setRequestState("forbidden");
          return;
        }

        const payload = (await httpResponse.json().catch(() => null)) as unknown;

        if (!httpResponse.ok) {
          setResponse(null);
          setRequestState("error");
          return;
        }

        const parsed = parseLaunchInterestApiResponse(payload);

        if (!parsed) {
          setResponse(null);
          setRequestState("error");
          return;
        }

        setResponse(parsed);
        setRequestState(parsed.items.length === 0 ? "empty" : "success");
      } catch {
        setResponse(null);
        setRequestState("error");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isAdmin || !accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void fetchLaunchInterests(page);
  }, [accessToken, fetchLaunchInterests, isAdmin, isAuthenticated, isLoading, page]);

  if (isLoading) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" aria-live="polite">
            <div className="flex items-center gap-3 text-slate-700">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              <p className="text-sm font-medium">Carregando sessão administrativa...</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8" aria-labelledby="admin-signin-required-title">
            <h1 id="admin-signin-required-title" className="text-2xl font-bold tracking-tight text-amber-900 sm:text-3xl">
              Área administrativa
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-amber-800">
              Para visualizar os interessados do lançamento, é necessário entrar com uma conta administrativa.
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
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
              <div>
                <h1 id="admin-forbidden-title" className="text-2xl font-bold tracking-tight text-red-900 sm:text-3xl">
                  Acesso não autorizado
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-red-800">
                  Sua conta não possui permissão para acessar a listagem administrativa de interessados.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Painel administrativo</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Interessados do lançamento
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Acompanhe os contatos recebidos no pré-lançamento da Soravi com segurança e foco no atendimento.
          </p>
        </header>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Listagem paginada</h2>
              <p className="mt-1 text-sm text-slate-600">
                Total de interessados: {response?.pagination.total ?? 0}
              </p>
            </div>

            <div className="text-sm text-slate-600">
              Página {response?.pagination.page ?? page} de {totalPages}
            </div>
          </div>

          {requestState === "loading" ? (
            <div className="py-12">
              <div className="flex items-center gap-3 text-slate-700">
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                <p className="text-sm font-medium">Carregando interessados...</p>
              </div>
            </div>
          ) : null}

          {requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
              <p className="text-sm font-medium leading-6 text-red-700">{buildErrorMessage(requestState)}</p>
              <button
                type="button"
                onClick={() => void fetchLaunchInterests(page)}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {requestState === "empty" ? (
            <div className="py-12">
              <p className="text-sm leading-6 text-slate-600">Nenhum interessado encontrado nesta página.</p>
            </div>
          ) : null}

          {requestState === "success" && response ? (
            <>
              <div className="mt-6 space-y-4 md:hidden">
                {response.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-base font-semibold text-slate-950">{item.name}</h3>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      <p>
                        <span className="font-medium text-slate-900">E-mail:</span> {item.email}
                      </p>
                      {item.phone ? (
                        <p>
                          <span className="font-medium text-slate-900">Telefone:</span> {item.phone}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-slate-900">Tipo:</span> {formatAudienceType(item.audienceType)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Cidade/UF:</span> {formatCityState(item.city, item.state)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Interesse:</span> {formatInterest(item)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Origem:</span> {formatSource(item.source)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Marketing:</span> {formatMarketingStatus(item)}
                      </p>
                      <p>
                        <span className="font-medium text-slate-900">Cadastro:</span> {formatRegistrationDate(item.createdAt)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="min-w-full border-separate border-spacing-0">
                  <caption className="sr-only">Lista administrativa de interessados do lançamento</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Nome
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Contato
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Tipo
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Cidade/UF
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Interesse
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Origem
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Marketing
                      </th>
                      <th scope="col" className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Cadastro
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {response.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-900">
                          <div className="font-semibold">{item.name}</div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          <p>{item.email}</p>
                          {item.phone ? <p className="mt-1 text-slate-600">{item.phone}</p> : null}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatAudienceType(item.audienceType)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatCityState(item.city, item.state)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatInterest(item)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatSource(item.source)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatMarketingStatus(item)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-sm text-slate-700">
                          {formatRegistrationDate(item.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={requestState === "loading" || isFirstPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            <p className="text-sm text-slate-600">
              Página {response?.pagination.page ?? page} de {totalPages}
            </p>

            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={requestState === "loading" || isLastPage}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
