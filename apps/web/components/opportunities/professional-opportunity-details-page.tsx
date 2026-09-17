"use client";

import {
  CalendarDays,
  ChevronLeft,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MessageCircle,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { contractStartUrl, opportunityByIdUrl, opportunityViewedUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { ImageLightbox } from "../shared/image-lightbox";
import {
  formatServiceRequestDate,
  isServiceRequestStatus,
  serviceRequestStatusPresentation,
  type ServiceRequestStatus,
} from "../service-requests/service-request-presentation";
import { ProfessionalProposalForm } from "./professional-proposal-form";

type OpportunityState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "error"
  | "unauthorized"
  | "forbidden";

interface OpportunityPhoto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  url: string;
}

interface OpportunityDetails {
  opportunityId: string;
  createdAt: string;
  viewedAt: string | null;
  conversationId: string | null;
  customerFirstName: string | null;
  contract: { id: string; status: "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } | null;
  serviceRequest: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceRequestStatus;
    category: {
      id: string;
      name: string;
    };
    location: {
      state: string;
      city: string;
      neighborhood: string;
    };
    photos: OpportunityPhoto[];
  };
}

interface ProfessionalOpportunityDetailsPageProps {
  opportunityId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function parseOpportunityDetails(payload: unknown): OpportunityDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!isRecord(root.serviceRequest)) {
    return null;
  }

  const { serviceRequest } = root;

  if (
    typeof root.opportunityId !== "string" ||
    typeof root.createdAt !== "string" ||
    !isNullableString(root.viewedAt) ||
    !isNullableString(root.conversationId) ||
    !isNullableString(root.customerFirstName) ||
    !(root.contract === null || (isRecord(root.contract) && typeof root.contract.id === "string" && typeof root.contract.status === "string")) ||
    typeof serviceRequest.id !== "string" ||
    typeof serviceRequest.title !== "string" ||
    !isNullableString(serviceRequest.description) ||
    !isServiceRequestStatus(serviceRequest.status) ||
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

  const rawPhotos = Array.isArray(serviceRequest.photos) ? serviceRequest.photos : [];

  const photos: OpportunityPhoto[] = [];

  for (const photo of rawPhotos) {
    if (!isRecord(photo) || typeof photo.id !== "string" || typeof photo.originalName !== "string" || typeof photo.mimeType !== "string" || typeof photo.sizeBytes !== "number" || !Number.isInteger(photo.sizeBytes) || photo.sizeBytes < 0 || typeof photo.position !== "number" || !Number.isInteger(photo.position) || photo.position < 0 || typeof photo.url !== "string") {
      return null;
    }

    photos.push({
      id: photo.id,
      originalName: photo.originalName,
      mimeType: photo.mimeType,
      sizeBytes: photo.sizeBytes,
      position: photo.position,
      url: photo.url,
    });
  }

  return {
    opportunityId: root.opportunityId,
    createdAt: root.createdAt,
    viewedAt: root.viewedAt,
    conversationId: root.conversationId,
    customerFirstName: root.customerFirstName,
    contract: root.contract as OpportunityDetails["contract"],
    serviceRequest: {
      id: serviceRequest.id,
      title: serviceRequest.title,
      description: serviceRequest.description,
      status: serviceRequest.status,
      category: {
        id: serviceRequest.category.id,
        name: serviceRequest.category.name,
      },
      location: {
        state: serviceRequest.location.state,
        city: serviceRequest.location.city,
        neighborhood: serviceRequest.location.neighborhood,
      },
      photos: [...photos].sort((first, second) => first.position - second.position),
    },
  };
}

export function ProfessionalOpportunityDetailsPage({
  opportunityId,
}: ProfessionalOpportunityDetailsPageProps) {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [opportunity, setOpportunity] = useState<OpportunityDetails | null>(
    null,
  );
  const [opportunityState, setOpportunityState] =
    useState<OpportunityState>("idle");
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [isStartingContract, setIsStartingContract] = useState(false);
  const [contractActionMessage, setContractActionMessage] = useState<string | null>(null);
  const viewedOpportunityIdRef = useRef<string | null>(null);

  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));

  const loadOpportunity = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setOpportunityState("loading");

    try {
      const response = await fetch(opportunityByIdUrl(opportunityId), {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 404) {
        setOpportunity(null);
        setOpportunityState("not-found");
        return;
      }

      if (response.status === 401) {
        setOpportunity(null);
        setOpportunityState("unauthorized");
        return;
      }

      if (response.status === 403) {
        setOpportunity(null);
        setOpportunityState("forbidden");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setOpportunity(null);
        setOpportunityState("error");
        return;
      }

      const parsedOpportunity = parseOpportunityDetails(payload);

      if (!parsedOpportunity) {
        setOpportunity(null);
        setOpportunityState("error");
        return;
      }

      setOpportunity(parsedOpportunity);
      setOpportunityState("success");
    } catch {
      setOpportunity(null);
      setOpportunityState("error");
    }
  }, [accessToken, opportunityId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isProfessional || !accessToken) {
      setOpportunity(null);
      setOpportunityState("idle");
      return;
    }

    void loadOpportunity();
  }, [
    accessToken,
    isAuthenticated,
    isLoading,
    isProfessional,
    loadOpportunity,
  ]);

  useEffect(() => {
    if (
      !accessToken ||
      opportunityState !== "success" ||
      !opportunity ||
      opportunity.viewedAt !== null ||
      viewedOpportunityIdRef.current === opportunity.opportunityId
    ) {
      return;
    }

    const viewedOpportunityId = opportunity.opportunityId;
    viewedOpportunityIdRef.current = viewedOpportunityId;

    async function markOpportunityViewed(): Promise<void> {
      try {
        const response = await fetch(
          opportunityViewedUrl(viewedOpportunityId),
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: "include",
          },
        );
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          return;
        }

        const markedOpportunity = parseOpportunityDetails(payload);

        if (markedOpportunity) {
          setOpportunity(markedOpportunity);
        }
      } catch {
        // A leitura do detalhe permanece disponível quando a marcação falha.
      }
    }

    void markOpportunityViewed();
  }, [accessToken, opportunity, opportunityState]);

  if (isLoading) {
    return <StatePage state="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <StatePage
        state="warning"
        title="Entre para ver esta oportunidade"
        description="Acesse sua conta profissional para consultar os detalhes."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  if (!isProfessional) {
    return (
      <StatePage
        state="error"
        title="Acesso exclusivo para profissionais"
        description="Esta página requer uma conta com perfil profissional."
      />
    );
  }

  if (opportunityState === "loading" || opportunityState === "idle") {
    return <StatePage state="loading" title="Carregando oportunidade..." />;
  }

  if (opportunityState === "not-found") {
    return (
      <StatePage
        state="warning"
        title="Oportunidade não encontrada"
        description="Não foi possível encontrar esta oportunidade."
        action={{
          href: "/profissional/oportunidades",
          label: "Voltar para oportunidades",
        }}
      />
    );
  }

  if (
    opportunityState === "error" ||
    opportunityState === "unauthorized" ||
    opportunityState === "forbidden" ||
    !accessToken ||
    !opportunity
  ) {
    const description =
      opportunityState === "unauthorized"
        ? "Sua sessão expirou. Entre novamente para continuar."
        : opportunityState === "forbidden"
          ? "Sua conta não possui permissão para consultar esta oportunidade."
          : "Não foi possível carregar os detalhes. Tente novamente em instantes.";

    return (
      <StatePage
        state="error"
        title="Não foi possível carregar a oportunidade"
        description={description}
        action={
          opportunityState === "unauthorized"
            ? { href: "/entrar", label: "Entrar novamente" }
            : undefined
        }
        onRetry={opportunityState === "error" ? loadOpportunity : undefined}
      />
    );
  }

  const { serviceRequest } = opportunity;
  const { location } = serviceRequest;
  const status = serviceRequestStatusPresentation[serviceRequest.status];
  const isUnviewed = opportunity.viewedAt === null;
  const canSubmitProposal =
    serviceRequest.status === "OPEN" ||
    serviceRequest.status === "RECEIVING_PROPOSALS";
  const proposalClosedMessage =
    serviceRequest.status === "HIRED"
      ? "Esta solicitação já foi contratada e não aceita novas propostas."
      : "Esta solicitação não aceita mais propostas no momento.";

  async function startContract(): Promise<void> {
    const contract = opportunity?.contract;
    if (!accessToken || !contract || isStartingContract || !window.confirm("Deseja iniciar este serviço?")) return;
    setIsStartingContract(true); setContractActionMessage(null);
    try {
      const response = await fetch(contractStartUrl(contract.id), { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" });
      if (!response.ok) throw new Error("contract start failed");
      setOpportunity((current) => current?.contract ? { ...current, contract: { ...current.contract, status: "IN_PROGRESS" } } : current);
      setContractActionMessage("Serviço iniciado com sucesso.");
    } catch { setContractActionMessage("Não foi possível iniciar o serviço. Tente novamente."); }
    finally { setIsStartingContract(false); }
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link href="/profissional/oportunidades" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar para oportunidades
        </Link>

        <header className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
            <div>
              <p className="font-semibold text-blue-600">
                {serviceRequest.category.name}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {serviceRequest.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {opportunity.customerFirstName
                  ? `Cliente: ${opportunity.customerFirstName}`
                  : "Cliente"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.className}`}>
                {status.label}
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${isUnviewed ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                {isUnviewed ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                {isUnviewed ? "Não visualizada" : "Visualizada"}
              </span>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays aria-hidden="true" className="size-4 text-slate-400" />
            Recebida em {formatServiceRequestDate(opportunity.createdAt)}
          </div>
          {typeof opportunity.conversationId === "string" ? (
            <Link href={`/conversas/${opportunity.conversationId}`} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              <MessageCircle aria-hidden="true" className="size-4" />
              Ir para conversa
            </Link>
          ) : null}
          {opportunity.contract ? (
            <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-live="polite">
              <p className="font-semibold text-blue-950">{opportunity.contract.status === "ACCEPTED" ? "Contratação aceita" : opportunity.contract.status === "IN_PROGRESS" ? "Serviço em andamento" : opportunity.contract.status === "COMPLETED" ? "Serviço concluído" : "Contratação cancelada"}</p>
              {opportunity.contract.status === "ACCEPTED" ? <button type="button" onClick={() => void startContract()} disabled={isStartingContract} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isStartingContract ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}{isStartingContract ? "Iniciando..." : "Iniciar serviço"}</button> : null}
              {contractActionMessage ? <p className={`mt-3 text-sm font-medium ${contractActionMessage === "Serviço iniciado com sucesso." ? "text-emerald-700" : "text-red-700"}`} role={contractActionMessage === "Serviço iniciado com sucesso." ? "status" : "alert"}>{contractActionMessage}</p> : null}
            </section>
          ) : null}
        </header>

        {serviceRequest.description ? (
          <section aria-labelledby="opportunity-description-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="size-5 text-blue-600" />
              <h2 id="opportunity-description-title" className="text-xl font-bold text-slate-950">
                Descrição do serviço
              </h2>
            </div>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
              {serviceRequest.description}
            </p>
          </section>
        ) : null}

        {serviceRequest.photos.length > 0 ? (
          <section aria-labelledby="opportunity-photos-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 id="opportunity-photos-title" className="text-xl font-bold text-slate-950">Fotos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceRequest.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`Ampliar imagem ${photo.originalName}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  onClick={() => setLightboxImage({ src: photo.url, alt: photo.originalName })}
                >
                  <img
                    src={photo.url}
                    alt={photo.originalName}
                    className="h-36 w-full cursor-pointer object-cover transition duration-200 hover:scale-[1.02] sm:h-40"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

        <section aria-labelledby="opportunity-location-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3">
            <MapPin aria-hidden="true" className="size-5 text-blue-600" />
            <h2 id="opportunity-location-title" className="text-xl font-bold text-slate-950">
              Localização aproximada
            </h2>
          </div>
          <div className="mt-4 space-y-1 leading-7 text-slate-700">
            {location.neighborhood ? <p>{location.neighborhood}</p> : null}
            <p>
              {location.city}, {location.state}
            </p>
          </div>
        </section>

        {canSubmitProposal ? (
          <ProfessionalProposalForm
            accessToken={accessToken}
            serviceRequestId={serviceRequest.id}
          />
        ) : (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-base font-medium text-slate-700">
              {proposalClosedMessage}
            </p>
          </section>
        )}
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
