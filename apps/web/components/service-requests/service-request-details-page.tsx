"use client";

import {
  CalendarDays,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Loader2,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { serviceRequestByIdUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import {
  formatServiceRequestDate,
  isServiceRequestStatus,
  serviceRequestStatusPresentation,
  type ServiceRequestStatus,
} from "./service-request-presentation";

type RequestState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "error"
  | "unauthorized"
  | "forbidden";

interface ServiceRequestDetails {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  status: ServiceRequestStatus;
  location: {
    country: string;
    state: string;
    city: string;
    neighborhood: string;
    postalCode: string;
    addressLine: string;
    addressNumber: string;
    addressComplement: string | null;
  };
  createdAt: string;
}

interface ServiceRequestDetailsPageProps {
  serviceRequestId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function parseServiceRequestDetails(payload: unknown): ServiceRequestDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (
    typeof root.id !== "string" ||
    typeof root.categoryId !== "string" ||
    typeof root.title !== "string" ||
    !isNullableString(root.description) ||
    !isServiceRequestStatus(root.status) ||
    !isRecord(root.location) ||
    typeof root.location.country !== "string" ||
    typeof root.location.state !== "string" ||
    typeof root.location.city !== "string" ||
    typeof root.location.neighborhood !== "string" ||
    typeof root.location.postalCode !== "string" ||
    typeof root.location.addressLine !== "string" ||
    typeof root.location.addressNumber !== "string" ||
    !isNullableString(root.location.addressComplement) ||
    typeof root.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: root.id,
    categoryId: root.categoryId,
    title: root.title,
    description: root.description,
    status: root.status,
    location: {
      country: root.location.country,
      state: root.location.state,
      city: root.location.city,
      neighborhood: root.location.neighborhood,
      postalCode: root.location.postalCode,
      addressLine: root.location.addressLine,
      addressNumber: root.location.addressNumber,
      addressComplement: root.location.addressComplement,
    },
    createdAt: root.createdAt,
  };
}

export function ServiceRequestDetailsPage({
  serviceRequestId,
}: ServiceRequestDetailsPageProps) {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [request, setRequest] = useState<ServiceRequestDetails | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");

  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));

  const loadServiceRequest = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setRequestState("loading");

    try {
      const httpResponse = await fetch(serviceRequestByIdUrl(serviceRequestId), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
      });

      if (httpResponse.status === 404) {
        setRequest(null);
        setRequestState("not-found");
        return;
      }

      if (httpResponse.status === 401) {
        setRequest(null);
        setRequestState("unauthorized");
        return;
      }

      if (httpResponse.status === 403) {
        setRequest(null);
        setRequestState("forbidden");
        return;
      }

      const payload: unknown = await httpResponse.json().catch(() => null);

      if (!httpResponse.ok) {
        setRequest(null);
        setRequestState("error");
        return;
      }

      const parsedRequest = parseServiceRequestDetails(payload);

      if (!parsedRequest) {
        setRequest(null);
        setRequestState("error");
        return;
      }

      setRequest(parsedRequest);
      setRequestState("success");
    } catch {
      setRequest(null);
      setRequestState("error");
    }
  }, [accessToken, serviceRequestId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isCustomer || !accessToken) {
      setRequest(null);
      setRequestState("idle");
      return;
    }

    void loadServiceRequest();
  }, [accessToken, isAuthenticated, isCustomer, isLoading, loadServiceRequest]);

  if (isLoading) {
    return <StatePage state="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <StatePage
        state="warning"
        title="Entre para ver esta solicitação"
        description="Acesse sua conta de cliente para consultar os detalhes."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  if (!isCustomer) {
    return (
      <StatePage
        state="error"
        title="Acesso exclusivo para clientes"
        description="Esta página requer uma conta com perfil de cliente."
      />
    );
  }

  if (requestState === "loading" || requestState === "idle") {
    return <StatePage state="loading" title="Carregando solicitação..." />;
  }

  if (requestState === "not-found") {
    return (
      <StatePage
        state="warning"
        title="Solicitação não encontrada"
        description="Não foi possível encontrar esta solicitação."
        action={{ href: "/solicitacoes", label: "Voltar para minhas solicitações" }}
      />
    );
  }

  if (
    requestState === "error" ||
    requestState === "unauthorized" ||
    requestState === "forbidden" ||
    !request
  ) {
    const description =
      requestState === "unauthorized"
        ? "Sua sessão expirou. Entre novamente para continuar."
        : requestState === "forbidden"
          ? "Sua conta não possui permissão para consultar esta solicitação."
          : "Não foi possível carregar os detalhes. Tente novamente em instantes.";

    return (
      <StatePage
        state="error"
        title="Não foi possível carregar a solicitação"
        description={description}
        action={
          requestState === "unauthorized"
            ? { href: "/entrar", label: "Entrar novamente" }
            : undefined
        }
        onRetry={requestState === "error" ? loadServiceRequest : undefined}
      />
    );
  }

  const status = serviceRequestStatusPresentation[request.status];
  const { location } = request;

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/solicitacoes" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar para minhas solicitações
        </Link>

        <header className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="font-semibold text-blue-600">Visão geral</p>
          <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {request.title}
            </h1>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays aria-hidden="true" className="size-4 text-slate-400" />
            Criada em {formatServiceRequestDate(request.createdAt)}
          </div>
        </header>

        {request.status === "DRAFT" ? (
          <section aria-labelledby="draft-information-title" className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ClipboardCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
              <div>
                <h2 id="draft-information-title" className="font-bold text-blue-950">Informações do rascunho</h2>
                <p className="mt-2 leading-7 text-blue-900/80">Esta solicitação está salva como rascunho e ainda não foi publicada.</p>
              </div>
            </div>
          </section>
        ) : null}

        {request.description ? (
          <section aria-labelledby="request-description-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="size-5 text-blue-600" />
              <h2 id="request-description-title" className="text-xl font-bold text-slate-950">Descrição</h2>
            </div>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{request.description}</p>
          </section>
        ) : null}

        <section aria-labelledby="request-location-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <MapPin aria-hidden="true" className="size-5 text-blue-600" />
            <h2 id="request-location-title" className="text-xl font-bold text-slate-950">Localização</h2>
          </div>
          <address className="mt-4 space-y-1 not-italic leading-7 text-slate-700">
            <p>{location.addressLine}, {location.addressNumber}</p>
            {location.addressComplement ? <p>{location.addressComplement}</p> : null}
            <p>{location.neighborhood}</p>
            <p>{location.city}, {location.state}</p>
            <p>CEP {location.postalCode}</p>
            <p>{location.country}</p>
          </address>
        </section>
      </div>
    </main>
  );
}

interface StatePageProps {
  state: "loading" | "warning" | "error";
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
  onRetry?: () => Promise<void>;
}

function StatePage({ state, title, description, action, onRetry }: StatePageProps) {
  const toneClassName =
    state === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : state === "error"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <section role={state === "error" ? "alert" : undefined} aria-live={state === "loading" ? "polite" : undefined} className={`rounded-2xl border p-6 shadow-sm sm:p-8 ${toneClassName}`}>
          <div className="flex items-start gap-3">
            {state === "loading" ? <Loader2 aria-hidden="true" className="mt-1 size-5 shrink-0 animate-spin" /> : null}
            {state === "error" ? <ShieldAlert aria-hidden="true" className="mt-1 size-5 shrink-0" /> : null}
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              {description ? <p className="mt-3 leading-7 opacity-80">{description}</p> : null}
              {action ? <Link href={action.href} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{action.label}</Link> : null}
              {onRetry ? <button type="button" onClick={() => void onRetry()} className="mt-6 font-semibold underline underline-offset-4">Tentar novamente</button> : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}