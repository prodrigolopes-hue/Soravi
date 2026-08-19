"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { myServiceRequestsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import {
  formatServiceRequestDate,
  isServiceRequestStatus,
  serviceRequestStatusPresentation,
  type ServiceRequestStatus,
} from "./service-request-presentation";

const PAGE_SIZE = 20;

type RequestState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

interface ServiceRequestItem {
  id: string;
  title: string;
  status: ServiceRequestStatus;
  location: {
    state: string;
    city: string;
  };
  createdAt: string;
}

interface ServiceRequestsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ServiceRequestsResponse {
  items: ServiceRequestItem[];
  pagination: ServiceRequestsPagination;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseServiceRequest(value: unknown): ServiceRequestItem | null {
  if (!isRecord(value) || !isRecord(value.location)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isServiceRequestStatus(value.status) ||
    typeof value.location.state !== "string" ||
    typeof value.location.city !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    status: value.status,
    location: {
      state: value.location.state,
      city: value.location.city,
    },
    createdAt: value.createdAt,
  };
}

function parseResponse(payload: unknown): ServiceRequestsResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items) || !isRecord(root.pagination)) {
    return null;
  }

  const items: ServiceRequestItem[] = [];

  for (const item of root.items) {
    const parsedItem = parseServiceRequest(item);

    if (!parsedItem) {
      return null;
    }

    items.push(parsedItem);
  }

  const { page, limit, total, totalPages } = root.pagination;

  if (
    !Number.isInteger(page) ||
    Number(page) < 1 ||
    !Number.isInteger(limit) ||
    Number(limit) < 1 ||
    !Number.isInteger(total) ||
    Number(total) < 0 ||
    !Number.isInteger(totalPages) ||
    Number(totalPages) < 0
  ) {
    return null;
  }

  return {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Number(totalPages),
    },
  };
}

export function MyServiceRequestsPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<ServiceRequestsResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");

  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);

  const loadServiceRequests = useCallback(
    async (targetPage: number): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setRequestState("loading");

      try {
        const url = new URL(myServiceRequestsUrl);
        url.searchParams.set("page", String(targetPage));
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("sort", "desc");

        const httpResponse = await fetch(url.toString(), {
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

        const payload: unknown = await httpResponse.json().catch(() => null);

        if (!httpResponse.ok) {
          setResponse(null);
          setRequestState("error");
          return;
        }

        const parsedResponse = parseResponse(payload);

        if (!parsedResponse) {
          setResponse(null);
          setRequestState("error");
          return;
        }

        setResponse(parsedResponse);
        setRequestState(parsedResponse.items.length === 0 ? "empty" : "success");
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

    if (!isAuthenticated || !isCustomer || !accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void loadServiceRequests(page);
  }, [accessToken, isAuthenticated, isCustomer, isLoading, loadServiceRequests, page]);

  if (isLoading) {
    return <PageMessage tone="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <PageMessage
        tone="warning"
        title="Entre para ver suas solicitações"
        description="Acesse sua conta de cliente para acompanhar os serviços solicitados."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  if (!isCustomer) {
    return (
      <PageMessage
        tone="error"
        title="Acesso exclusivo para clientes"
        description="Esta página requer uma conta com perfil de cliente."
      />
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-blue-600">Seus pedidos de serviço</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Minhas solicitações
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Acompanhe o andamento das solicitações criadas por você.
            </p>
          </div>

          <Link href="/solicitacoes/nova" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
            <Plus aria-hidden="true" className="size-5" />
            Nova solicitação
          </Link>
        </header>

        <section className="mt-8" aria-live="polite" aria-busy={requestState === "loading"}>
          {requestState === "loading" || requestState === "idle" ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
              <Loader2 aria-hidden="true" className="mr-3 size-5 animate-spin" />
              Carregando solicitações...
            </div>
          ) : null}

          {requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" />
                <div>
                  <h2 className="text-xl font-bold text-red-950">Não foi possível carregar suas solicitações</h2>
                  <p className="mt-2 leading-7 text-red-900/80">
                    {requestState === "unauthorized" ? "Sua sessão expirou. Entre novamente para continuar." : requestState === "forbidden" ? "Sua conta não possui permissão para acessar esta listagem." : "Tente novamente em instantes."}
                  </p>
                  {requestState === "unauthorized" ? (
                    <Link href="/entrar" className="mt-5 inline-flex font-semibold text-red-800 underline underline-offset-4">Entrar novamente</Link>
                  ) : (
                    <button type="button" onClick={() => void loadServiceRequests(page)} className="mt-5 font-semibold text-red-800 underline underline-offset-4">Tentar novamente</button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {requestState === "empty" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
              <ClipboardList aria-hidden="true" className="mx-auto size-10 text-blue-600" />
              <h2 className="mt-4 text-2xl font-bold text-slate-950">Você ainda não criou uma solicitação</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">Conte o que precisa e salve sua primeira solicitação como rascunho.</p>
              <Link href="/solicitacoes/nova" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <Plus aria-hidden="true" className="size-5" />
                Criar primeira solicitação
              </Link>
            </div>
          ) : null}

          {requestState === "success" && response ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {response.items.map((request) => {
                  const status = serviceRequestStatusPresentation[request.status];

                  return (
                    <article key={request.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-lg font-bold leading-7 text-slate-950">{request.title}</h2>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      </div>
                      <dl className="mt-5 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                          <dt className="sr-only">Localização</dt>
                          <dd>{request.location.city}, {request.location.state}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                          <dt className="sr-only">Data de criação</dt>
                          <dd>Criada em {formatServiceRequestDate(request.createdAt)}</dd>
                        </div>
                      </dl>
                      <Link href={`/solicitacoes/${request.id}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                        Ver detalhes
                      </Link>
                    </article>
                  );
                })}
              </div>

              {response.pagination.totalPages > 1 ? (
                <nav aria-label="Paginação das solicitações" className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Anterior
                  </button>
                  <p className="text-sm font-medium text-slate-600">Página {response.pagination.page} de {response.pagination.totalPages}</p>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    Próxima
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

interface PageMessageProps {
  tone: "loading" | "warning" | "error";
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
}

function PageMessage({ tone, title, description, action }: PageMessageProps) {
  const toneClassName = tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : tone === "error" ? "border-red-200 bg-red-50 text-red-950" : "border-slate-200 bg-white text-slate-700";

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section role={tone === "error" ? "alert" : undefined} aria-live={tone === "loading" ? "polite" : undefined} className={`rounded-2xl border p-6 shadow-sm sm:p-8 ${toneClassName}`}>
          <div className="flex items-start gap-3">
            {tone === "loading" ? <Loader2 aria-hidden="true" className="mt-1 size-5 shrink-0 animate-spin" /> : null}
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {description ? <p className="mt-3 leading-7 opacity-80">{description}</p> : null}
              {action ? <Link href={action.href} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}