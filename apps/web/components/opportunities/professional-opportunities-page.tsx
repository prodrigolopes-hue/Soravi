"use client";

import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { opportunitiesUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { formatServiceRequestDate } from "../service-requests/service-request-presentation";

const PAGE_SIZE = 20;

type OpportunitiesState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

interface OpportunityItem {
  id: string;
  createdAt: string;
  viewedAt: string | null;
  serviceRequest: {
    id: string;
    title: string;
    description: string | null;
    category: {
      id: string;
      name: string;
    };
    location: {
      state: string;
      city: string;
      neighborhood: string;
    };
  };
}

interface OpportunitiesResponse {
  items: OpportunityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function parseOpportunity(value: unknown): OpportunityItem | null {
  if (!isRecord(value) || !isRecord(value.serviceRequest)) {
    return null;
  }

  const { serviceRequest } = value;

  if (
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    !isNullableString(value.viewedAt) ||
    typeof serviceRequest.id !== "string" ||
    typeof serviceRequest.title !== "string" ||
    !isNullableString(serviceRequest.description) ||
    !isRecord(serviceRequest.category) ||
    typeof serviceRequest.category.id !== "string" ||
    typeof serviceRequest.category.name !== "string" ||
    !isRecord(serviceRequest.location) ||
    typeof serviceRequest.location.state !== "string" ||
    typeof serviceRequest.location.city !== "string" ||
    typeof serviceRequest.location.neighborhood !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    viewedAt: value.viewedAt,
    serviceRequest: {
      id: serviceRequest.id,
      title: serviceRequest.title,
      description: serviceRequest.description,
      category: {
        id: serviceRequest.category.id,
        name: serviceRequest.category.name,
      },
      location: {
        state: serviceRequest.location.state,
        city: serviceRequest.location.city,
        neighborhood: serviceRequest.location.neighborhood,
      },
    },
  };
}

function parseResponse(payload: unknown): OpportunitiesResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items) || !isRecord(root.pagination)) {
    return null;
  }

  const items: OpportunityItem[] = [];

  for (const item of root.items) {
    const parsedItem = parseOpportunity(item);

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

export function ProfessionalOpportunitiesPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<OpportunitiesResponse | null>(null);
  const [opportunitiesState, setOpportunitiesState] =
    useState<OpportunitiesState>("idle");

  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);

  const loadOpportunities = useCallback(
    async (targetPage: number): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setOpportunitiesState("loading");

      try {
        const url = new URL(opportunitiesUrl);
        url.searchParams.set("page", String(targetPage));
        url.searchParams.set("limit", String(PAGE_SIZE));

        const httpResponse = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        });

        if (httpResponse.status === 401) {
          setResponse(null);
          setOpportunitiesState("unauthorized");
          return;
        }

        if (httpResponse.status === 403) {
          setResponse(null);
          setOpportunitiesState("forbidden");
          return;
        }

        const payload: unknown = await httpResponse.json().catch(() => null);

        if (!httpResponse.ok) {
          setResponse(null);
          setOpportunitiesState("error");
          return;
        }

        const parsedResponse = parseResponse(payload);

        if (!parsedResponse) {
          setResponse(null);
          setOpportunitiesState("error");
          return;
        }

        setResponse(parsedResponse);
        setOpportunitiesState(
          parsedResponse.items.length === 0 ? "empty" : "success",
        );
      } catch {
        setResponse(null);
        setOpportunitiesState("error");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isProfessional || !accessToken) {
      setResponse(null);
      setOpportunitiesState("idle");
      return;
    }

    void loadOpportunities(page);
  }, [
    accessToken,
    isAuthenticated,
    isLoading,
    isProfessional,
    loadOpportunities,
    page,
  ]);

  if (isLoading) {
    return <PageMessage tone="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <PageMessage
        tone="warning"
        title="Entre para ver suas oportunidades"
        description="Acesse sua conta profissional para acompanhar os serviços disponíveis."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  if (!isProfessional) {
    return (
      <PageMessage
        tone="error"
        title="Acesso exclusivo para profissionais"
        description="Esta página requer uma conta com perfil profissional."
      />
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <header>
          <p className="font-semibold text-blue-600">Serviços disponíveis</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Oportunidades
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Veja solicitações de serviço compatíveis com suas categorias.
          </p>
        </header>

        <section
          className="mt-8"
          aria-live="polite"
          aria-busy={opportunitiesState === "loading"}
        >
          {opportunitiesState === "loading" || opportunitiesState === "idle" ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
              <Loader2 aria-hidden="true" className="mr-3 size-5 animate-spin" />
              Carregando oportunidades...
            </div>
          ) : null}

          {opportunitiesState === "error" ||
          opportunitiesState === "unauthorized" ||
          opportunitiesState === "forbidden" ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" />
                <div>
                  <h2 className="text-xl font-bold text-red-950">
                    Não foi possível carregar suas oportunidades
                  </h2>
                  <p className="mt-2 leading-7 text-red-900/80">
                    {opportunitiesState === "unauthorized"
                      ? "Sua sessão expirou. Entre novamente para continuar."
                      : opportunitiesState === "forbidden"
                        ? "Sua conta não possui permissão para acessar esta listagem."
                        : "Tente novamente em instantes."}
                  </p>
                  {opportunitiesState === "unauthorized" ? (
                    <Link href="/entrar" className="mt-5 inline-flex font-semibold text-red-800 underline underline-offset-4">
                      Entrar novamente
                    </Link>
                  ) : (
                    <button type="button" onClick={() => void loadOpportunities(page)} className="mt-5 font-semibold text-red-800 underline underline-offset-4">
                      Tentar novamente
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {opportunitiesState === "empty" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
              <BriefcaseBusiness aria-hidden="true" className="mx-auto size-10 text-blue-600" />
              <h2 className="mt-4 text-2xl font-bold text-slate-950">
                Nenhuma oportunidade por enquanto
              </h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
                Quando houver solicitações compatíveis com suas categorias, elas aparecerão aqui.
              </p>
            </div>
          ) : null}

          {opportunitiesState === "success" && response ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {response.items.map((opportunity) => {
                  const { serviceRequest } = opportunity;
                  const { location } = serviceRequest;
                  const isUnviewed = opportunity.viewedAt === null;

                  return (
                    <Link key={opportunity.id} href={`/profissional/oportunidades/${opportunity.id}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-blue-600">
                            {serviceRequest.category.name}
                          </p>
                          <h2 className="mt-2 text-lg font-bold leading-7 text-slate-950">
                            {serviceRequest.title}
                          </h2>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${isUnviewed ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {isUnviewed ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                          {isUnviewed ? "Não visualizada" : "Visualizada"}
                        </span>
                      </div>

                      {serviceRequest.description ? (
                        <p className="mt-4 line-clamp-3 leading-6 text-slate-600">
                          {serviceRequest.description}
                        </p>
                      ) : null}

                      <dl className="mt-5 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                          <dt className="sr-only">Localização aproximada</dt>
                          <dd>
                            {location.neighborhood ? `${location.neighborhood}, ` : ""}
                            {location.city}, {location.state}
                          </dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                          <dt className="sr-only">Data da oportunidade</dt>
                          <dd>Recebida em {formatServiceRequestDate(opportunity.createdAt)}</dd>
                        </div>
                      </dl>
                    </Link>
                  );
                })}
              </div>

              {response.pagination.totalPages > 1 ? (
                <nav aria-label="Paginação das oportunidades" className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Anterior
                  </button>
                  <p className="text-sm font-medium text-slate-600">
                    Página {response.pagination.page} de {response.pagination.totalPages}
                  </p>
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
  const toneClassName =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-slate-200 bg-white text-slate-700";

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