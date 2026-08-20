"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CheckCircle2, ChevronLeft, CircleX, ClipboardCheck, Clock3, FileText, Loader2, MapPin, Pencil, Save, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { categoriesUrl, serviceRequestByIdUrl, serviceRequestCancelUrl, serviceRequestProposalsUrl } from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import { serviceRequestSchema, type ServiceRequestFormData } from "./service-request-form-schema";
import { formatServiceRequestDate, isServiceRequestStatus, serviceRequestStatusPresentation, type ServiceRequestStatus } from "./service-request-presentation";

type RequestState = "idle" | "loading" | "success" | "not-found" | "error" | "unauthorized" | "forbidden";
type CategoriesState = "idle" | "loading" | "success" | "empty" | "error";
type ProposalsState = "idle" | "loading" | "success" | "empty" | "error" | "unauthorized" | "forbidden";
type EditMessageTone = "success" | "error";

const proposalDurationUnits = ["HOUR", "DAY", "WEEK", "MONTH"] as const;
type ProposalDurationUnit = (typeof proposalDurationUnits)[number];
type ProposalStatus = "ACTIVE" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";

const proposalStatusLabels: Record<ProposalStatus, string> = {
  ACTIVE: "Ativa",
  ACCEPTED: "Aceita",
  REJECTED: "Rejeitada",
  WITHDRAWN: "Retirada",
  EXPIRED: "Expirada",
};

const proposalStatusTones: Record<ProposalStatus, string> = {
  ACTIVE: "border-blue-200 bg-blue-50 text-blue-700",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  WITHDRAWN: "border-slate-200 bg-slate-100 text-slate-700",
  EXPIRED: "border-amber-200 bg-amber-50 text-amber-700",
};

interface ServiceCategory {
  id: string;
  name: string;
}

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
  editableUntil: string;
  createdAt: string;
}

interface ProposalReceived {
  id: string;
  amountInCents: number;
  estimatedDurationValue: number;
  estimatedDurationUnit: ProposalDurationUnit;
  message: string;
  status: ProposalStatus;
  submittedAt: string;
}

interface ProposalsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProposalsResponse {
  items: ProposalReceived[];
  pagination: ProposalsPagination;
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

function isServiceCategory(value: unknown): value is ServiceCategory {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function isProposalDurationUnit(value: unknown): value is ProposalDurationUnit {
  return proposalDurationUnits.some((unit) => unit === value);
}

function isProposalStatus(value: unknown): value is ProposalStatus {
  return typeof value === "string" && value in proposalStatusLabels;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function parseProposalsResponse(payload: unknown): ProposalsResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items) || !isRecord(root.pagination)) {
    return null;
  }

  const pagination = root.pagination;

  if (!isPositiveInteger(pagination.page) || !isPositiveInteger(pagination.limit) || !isNonNegativeInteger(pagination.total) || !isNonNegativeInteger(pagination.totalPages)) {
    return null;
  }

  const items: ProposalReceived[] = [];

  for (const item of root.items) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.amountInCents !== "number" || !Number.isInteger(item.amountInCents) || item.amountInCents < 0 || typeof item.estimatedDurationValue !== "number" || !Number.isInteger(item.estimatedDurationValue) || item.estimatedDurationValue < 1 || !isProposalDurationUnit(item.estimatedDurationUnit) || typeof item.message !== "string" || !isProposalStatus(item.status) || typeof item.submittedAt !== "string") {
      return null;
    }

    items.push({
      id: item.id,
      amountInCents: item.amountInCents,
      estimatedDurationValue: item.estimatedDurationValue,
      estimatedDurationUnit: item.estimatedDurationUnit,
      message: item.message,
      status: item.status,
      submittedAt: item.submittedAt,
    });
  }

  return {
    items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}

function formatProposalAmount(amountInCents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountInCents / 100);
}

function formatProposalDuration(value: number, unit: ProposalDurationUnit): string {
  const labels: Record<ProposalDurationUnit, [string, string]> = {
    HOUR: ["hora", "horas"],
    DAY: ["dia", "dias"],
    WEEK: ["semana", "semanas"],
    MONTH: ["mês", "meses"],
  };

  return `${value} ${value === 1 ? labels[unit][0] : labels[unit][1]}`;
}

function formatProposalDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { message } = payload;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(message)) {
    return message.find((item): item is string => typeof item === "string" && item.trim().length > 0)?.trim() ?? null;
  }

  return null;
}

function parseServiceRequestDetails(payload: unknown): ServiceRequestDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (typeof root.id !== "string" || typeof root.categoryId !== "string" || typeof root.title !== "string" || !isNullableString(root.description) || !isServiceRequestStatus(root.status) || !isRecord(root.location) || typeof root.location.country !== "string" || typeof root.location.state !== "string" || typeof root.location.city !== "string" || typeof root.location.neighborhood !== "string" || typeof root.location.postalCode !== "string" || typeof root.location.addressLine !== "string" || typeof root.location.addressNumber !== "string" || !isNullableString(root.location.addressComplement) || typeof root.editableUntil !== "string" || typeof root.createdAt !== "string") {
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
    editableUntil: root.editableUntil,
    createdAt: root.createdAt,
  };
}

const fieldClassName = "mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100";

interface FieldErrorProps {
  id: string;
  message?: string;
}

function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-red-600">
      {message}
    </p>
  ) : null;
}

export function ServiceRequestDetailsPage({ serviceRequestId }: ServiceRequestDetailsPageProps) {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const [request, setRequest] = useState<ServiceRequestDetails | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [isEditing, setIsEditing] = useState(false);
  const [editBlockedByServer, setEditBlockedByServer] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [categoriesState, setCategoriesState] = useState<CategoriesState>("idle");
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [proposals, setProposals] = useState<ProposalsResponse | null>(null);
  const [proposalsState, setProposalsState] = useState<ProposalsState>("idle");
  const [proposalsPage, setProposalsPage] = useState(1);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editMessageTone, setEditMessageTone] = useState<EditMessageTone>("success");
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelBlockedByServer, setCancelBlockedByServer] = useState(false);

  const isCustomer = Boolean(user?.roles.includes("CUSTOMER"));
  const editableUntilTimestamp = request ? Date.parse(request.editableUntil) : Number.NaN;
  const hasOpenEditWindow = Boolean(request?.status === "OPEN" && Number.isFinite(editableUntilTimestamp) && now <= editableUntilTimestamp);
  const canEdit = hasOpenEditWindow && !editBlockedByServer;
  const canCancel = request?.status === "OPEN" && !cancelBlockedByServer;
  const remainingMinutes = Math.max(0, Math.ceil((editableUntilTimestamp - now) / 60_000));
  const proposalsTotalPages = Math.max(1, proposals?.pagination.totalPages ?? 1);
  const proposalsIsFirstPage = proposalsPage <= 1;
  const proposalsIsLastPage = proposalsPage >= proposalsTotalPages;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceRequestFormData>({
    resolver: zodResolver(serviceRequestSchema),
    mode: "onSubmit",
  });

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

  useEffect(() => {
    if (!request || request.status !== "OPEN") {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(intervalId);
  }, [request]);

  useEffect(() => {
    if (!isEditing || canEdit) {
      return;
    }

    setIsEditing(false);
    setEditMessageTone("error");
    setEditMessage("Esta solicitação não pode mais ser alterada diretamente. Alterações posteriores precisarão de análise da Soravi.");
  }, [canEdit, isEditing]);

  useEffect(() => {
    if (!isEditing || !isAuthenticated || !isCustomer) {
      return;
    }

    const abortController = new AbortController();

    async function loadCategories(): Promise<void> {
      setCategoriesState("loading");

      try {
        const response = await fetch(categoriesUrl, {
          signal: abortController.signal,
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(payload)) {
          setCategories([]);
          setCategoriesState("error");
          return;
        }

        const parsedCategories = payload.filter(isServiceCategory);
        setCategories(parsedCategories);
        setCategoriesState(parsedCategories.length > 0 ? "success" : "empty");
      } catch {
        if (!abortController.signal.aborted) {
          setCategories([]);
          setCategoriesState("error");
        }
      }
    }

    void loadCategories();

    return () => abortController.abort();
  }, [categoriesReloadKey, isAuthenticated, isCustomer, isEditing]);

  const loadProposals = useCallback(async (targetPage: number): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setProposalsState("loading");

    try {
      const url = new URL(serviceRequestProposalsUrl(serviceRequestId));
      url.searchParams.set("page", String(targetPage));
      url.searchParams.set("limit", "20");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        setProposals(null);
        setProposalsState("unauthorized");
        return;
      }

      if (response.status === 403) {
        setProposals(null);
        setProposalsState("forbidden");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setProposals(null);
        setProposalsState("error");
        return;
      }

      const parsedProposals = parseProposalsResponse(payload);

      if (!parsedProposals) {
        setProposals(null);
        setProposalsState("error");
        return;
      }

      setProposals(parsedProposals);
      setProposalsState(parsedProposals.items.length > 0 ? "success" : "empty");
    } catch {
      setProposals(null);
      setProposalsState("error");
    }
  }, [accessToken, serviceRequestId]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isCustomer || !accessToken) {
      setProposals(null);
      setProposalsState("idle");
      return;
    }

    void loadProposals(proposalsPage);
  }, [accessToken, isAuthenticated, isCustomer, isLoading, loadProposals, proposalsPage]);

  function startEditing(): void {
    if (!request || !canEdit) {
      return;
    }

    reset({
      categoryId: request.categoryId,
      title: request.title,
      description: request.description ?? "",
      location: {
        ...request.location,
        addressComplement: request.location.addressComplement ?? "",
      },
    });
    setEditMessage(null);
    setCategoriesState("idle");
    setIsEditing(true);
  }

  function openCancelConfirmation(): void {
    if (!request || !canCancel) {
      return;
    }

    setIsEditing(false);
    setEditMessage(null);
    setCancellationReason("");
    setIsCancelConfirmationOpen(true);
  }

  async function submitUpdate(data: ServiceRequestFormData): Promise<void> {
    if (!accessToken || !request || !canEdit || isSubmitting) {
      return;
    }

    if (!categories.some((category) => category.id === data.categoryId)) {
      setError("categoryId", {
        type: "manual",
        message: "Selecione uma categoria disponível.",
      });
      return;
    }

    setEditMessage(null);

    try {
      const response = await fetch(serviceRequestByIdUrl(request.id), {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          categoryId: data.categoryId,
          title: data.title,
          description: data.description,
          location: {
            country: data.location.country,
            state: data.location.state.toUpperCase(),
            city: data.location.city,
            neighborhood: data.location.neighborhood,
            postalCode: data.location.postalCode,
            addressLine: data.location.addressLine,
            addressNumber: data.location.addressNumber,
            addressComplement: data.location.addressComplement,
          },
        }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 409) {
        setEditBlockedByServer(true);
        setIsEditing(false);
        setEditMessageTone("error");
        setEditMessage("Esta solicitação não pode mais ser alterada diretamente. Alterações posteriores precisarão de análise da Soravi.");
        return;
      }

      if (!response.ok) {
        setEditMessageTone("error");
        setEditMessage(extractErrorMessage(payload) ?? "Não foi possível salvar as alterações. Tente novamente.");
        return;
      }

      const updatedRequest = parseServiceRequestDetails(payload);

      if (!updatedRequest) {
        setEditMessageTone("error");
        setEditMessage("As alterações foram enviadas, mas não foi possível atualizar os dados exibidos.");
        return;
      }

      setRequest(updatedRequest);
      setIsEditing(false);
      setEditMessageTone("success");
      setEditMessage("Solicitação atualizada com sucesso.");
    } catch {
      setEditMessageTone("error");
      setEditMessage("Não foi possível conectar à Soravi. Tente novamente em instantes.");
    }
  }

  async function cancelServiceRequest(): Promise<void> {
    if (!accessToken || !request || !canCancel || isCancelling) {
      return;
    }

    const reason = cancellationReason.trim();
    setIsCancelling(true);
    setEditMessage(null);

    try {
      const response = await fetch(serviceRequestCancelUrl(request.id), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.status === 409) {
        setCancelBlockedByServer(true);
        setIsCancelConfirmationOpen(false);
        setEditMessageTone("error");
        setEditMessage("Esta solicitação não pode mais ser cancelada diretamente.");
        return;
      }

      if (response.status === 404) {
        setCancelBlockedByServer(true);
        setIsCancelConfirmationOpen(false);
        setEditMessageTone("error");
        setEditMessage("Solicitação não encontrada.");
        return;
      }

      if (!response.ok) {
        setEditMessageTone("error");
        setEditMessage(extractErrorMessage(payload) ?? "Não foi possível cancelar a solicitação. Tente novamente.");
        return;
      }

      const cancelledRequest = parseServiceRequestDetails(payload);

      if (!cancelledRequest) {
        setEditMessageTone("error");
        setEditMessage("A solicitação foi cancelada, mas não foi possível atualizar os dados exibidos.");
        return;
      }

      setRequest(cancelledRequest);
      setIsCancelConfirmationOpen(false);
      setCancellationReason("");
      setIsEditing(false);
      setEditMessageTone("success");
      setEditMessage("Solicitação cancelada com sucesso.");
    } catch {
      setEditMessageTone("error");
      setEditMessage("Não foi possível conectar à Soravi. Tente novamente em instantes.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return <StatePage state="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return <StatePage state="warning" title="Entre para ver esta solicitação" description="Acesse sua conta de cliente para consultar os detalhes." action={{ href: "/entrar", label: "Entrar" }} />;
  }

  if (!isCustomer) {
    return <StatePage state="error" title="Acesso exclusivo para clientes" description="Esta página requer uma conta com perfil de cliente." />;
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
        action={{
          href: "/solicitacoes",
          label: "Voltar para minhas solicitações",
        }}
      />
    );
  }

  if (requestState === "error" || requestState === "unauthorized" || requestState === "forbidden" || !request) {
    const description = requestState === "unauthorized" ? "Sua sessão expirou. Entre novamente para continuar." : requestState === "forbidden" ? "Sua conta não possui permissão para consultar esta solicitação." : "Não foi possível carregar os detalhes. Tente novamente em instantes.";

    return <StatePage state="error" title="Não foi possível carregar a solicitação" description={description} action={requestState === "unauthorized" ? { href: "/entrar", label: "Entrar novamente" } : undefined} onRetry={requestState === "error" ? loadServiceRequest : undefined} />;
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{request.title}</h1>
            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.className}`}>{status.label}</span>
          </div>
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays aria-hidden="true" className="size-4 text-slate-400" />
            Criada em {formatServiceRequestDate(request.createdAt)}
          </div>

          {canEdit ? (
            <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-700" aria-live="polite">
                <Clock3 aria-hidden="true" className="size-4 text-blue-600" />
                Você pode editar esta solicitação pelos próximos {remainingMinutes} {remainingMinutes === 1 ? "minuto" : "minutos"}.
              </p>
              {!isEditing && !isCancelConfirmationOpen ? (
                <button type="button" onClick={startEditing} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                  <Pencil aria-hidden="true" className="size-4" />
                  Editar solicitação
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-600">Esta solicitação não pode mais ser alterada diretamente. Alterações posteriores precisarão de análise da Soravi.</p>
          )}

          {canCancel && !isEditing && !isCancelConfirmationOpen ? (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <button type="button" onClick={openCancelConfirmation} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 font-semibold text-red-700 hover:border-red-400 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                <CircleX aria-hidden="true" className="size-4" />
                Cancelar solicitação
              </button>
            </div>
          ) : null}
        </header>

        {editMessage ? (
          <div role={editMessageTone === "error" ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border p-4 ${editMessageTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {editMessageTone === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
            <p className="font-medium leading-6">{editMessage}</p>
          </div>
        ) : null}

        {isCancelConfirmationOpen ? (
          <section aria-labelledby="cancel-request-title" className="mt-5 rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <CircleX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" />
              <div>
                <h2 id="cancel-request-title" className="text-xl font-bold text-slate-950">
                  Tem certeza que deseja cancelar esta solicitação?
                </h2>
                <p className="mt-2 leading-7 text-slate-600">Ela não será enviada a novos profissionais.</p>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="cancellation-reason" className="text-sm font-semibold text-slate-800">
                Motivo <span className="font-normal text-slate-500">(opcional)</span>
              </label>
              <textarea id="cancellation-reason" rows={4} maxLength={1000} value={cancellationReason} disabled={isCancelling} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Conte brevemente por que deseja cancelar" className={fieldClassName} />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={isCancelling} onClick={() => setIsCancelConfirmationOpen(false)} className="inline-flex min-h-12 items-center justify-center px-5 py-3 font-semibold text-slate-700 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                Voltar
              </button>
              <button type="button" disabled={isCancelling} onClick={() => void cancelServiceRequest()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-red-300">
                {isCancelling ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <CircleX aria-hidden="true" className="size-5" />}
                {isCancelling ? "Cancelando..." : "Cancelar solicitação"}
              </button>
            </div>
          </section>
        ) : null}

        {isEditing ? (
          <form onSubmit={handleSubmit(submitUpdate)} noValidate className="mt-5 space-y-5">
            <section aria-labelledby="edit-request-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="edit-request-title" className="text-xl font-bold text-slate-950">
                    Editar solicitação
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Atualize os dados antes do encerramento da janela inicial.</p>
                </div>
                <button type="button" title="Cancelar edição" aria-label="Cancelar edição" disabled={isSubmitting} onClick={() => setIsEditing(false)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>

              <fieldset disabled={isSubmitting} className="mt-6 space-y-5">
                <legend className="sr-only">Dados da solicitação</legend>
                <div>
                  <label htmlFor="edit-categoryId" className="text-sm font-semibold text-slate-800">
                    Categoria
                  </label>
                  <select id="edit-categoryId" disabled={categoriesState !== "success" || isSubmitting} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "edit-categoryId-error" : undefined} className={fieldClassName} {...register("categoryId")}>
                    <option value="">{categoriesState === "loading" || categoriesState === "idle" ? "Carregando categorias..." : "Selecione uma categoria"}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="edit-categoryId-error" message={errors.categoryId?.message} />
                  {categoriesState === "error" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3" role="alert">
                      <p className="text-sm font-medium text-red-600">Não foi possível carregar as categorias.</p>
                      <button type="button" onClick={() => setCategoriesReloadKey((value) => value + 1)} className="text-sm font-semibold text-blue-600 underline underline-offset-4">
                        Tentar novamente
                      </button>
                    </div>
                  ) : null}
                  {categoriesState === "empty" ? (
                    <p className="mt-2 text-sm text-amber-700" role="status">
                      Nenhuma categoria está disponível no momento.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="edit-title" className="text-sm font-semibold text-slate-800">
                    Título
                  </label>
                  <input id="edit-title" type="text" maxLength={160} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "edit-title-error" : undefined} className={fieldClassName} {...register("title")} />
                  <FieldError id="edit-title-error" message={errors.title?.message} />
                </div>

                <div>
                  <label htmlFor="edit-description" className="text-sm font-semibold text-slate-800">
                    Descrição <span className="font-normal text-slate-500">(opcional)</span>
                  </label>
                  <textarea id="edit-description" rows={5} maxLength={2000} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "edit-description-error" : undefined} className={fieldClassName} {...register("description")} />
                  <FieldError id="edit-description-error" message={errors.description?.message} />
                </div>
              </fieldset>
            </section>

            <fieldset disabled={isSubmitting} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <legend className="sr-only">Localização do serviço</legend>
              <div className="flex items-center gap-3">
                <MapPin aria-hidden="true" className="size-5 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-950">Localização</h2>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-country" className="text-sm font-semibold text-slate-800">
                    País
                  </label>
                  <input id="edit-country" type="text" readOnly className={fieldClassName} {...register("location.country")} />
                </div>
                <div>
                  <label htmlFor="edit-state" className="text-sm font-semibold text-slate-800">
                    Estado (UF)
                  </label>
                  <input id="edit-state" type="text" maxLength={2} autoCapitalize="characters" aria-invalid={Boolean(errors.location?.state)} aria-describedby={errors.location?.state ? "edit-state-error" : undefined} className={fieldClassName} {...register("location.state")} />
                  <FieldError id="edit-state-error" message={errors.location?.state?.message} />
                </div>
                <div>
                  <label htmlFor="edit-city" className="text-sm font-semibold text-slate-800">
                    Cidade
                  </label>
                  <input id="edit-city" type="text" maxLength={120} autoComplete="address-level2" aria-invalid={Boolean(errors.location?.city)} aria-describedby={errors.location?.city ? "edit-city-error" : undefined} className={fieldClassName} {...register("location.city")} />
                  <FieldError id="edit-city-error" message={errors.location?.city?.message} />
                </div>
                <div>
                  <label htmlFor="edit-neighborhood" className="text-sm font-semibold text-slate-800">
                    Bairro
                  </label>
                  <input id="edit-neighborhood" type="text" maxLength={120} aria-invalid={Boolean(errors.location?.neighborhood)} aria-describedby={errors.location?.neighborhood ? "edit-neighborhood-error" : undefined} className={fieldClassName} {...register("location.neighborhood")} />
                  <FieldError id="edit-neighborhood-error" message={errors.location?.neighborhood?.message} />
                </div>
                <div>
                  <label htmlFor="edit-postalCode" className="text-sm font-semibold text-slate-800">
                    CEP
                  </label>
                  <input id="edit-postalCode" type="text" maxLength={16} inputMode="numeric" autoComplete="postal-code" aria-invalid={Boolean(errors.location?.postalCode)} aria-describedby={errors.location?.postalCode ? "edit-postalCode-error" : undefined} className={fieldClassName} {...register("location.postalCode")} />
                  <FieldError id="edit-postalCode-error" message={errors.location?.postalCode?.message} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-addressLine" className="text-sm font-semibold text-slate-800">
                    Endereço
                  </label>
                  <input id="edit-addressLine" type="text" maxLength={255} autoComplete="address-line1" aria-invalid={Boolean(errors.location?.addressLine)} aria-describedby={errors.location?.addressLine ? "edit-addressLine-error" : undefined} className={fieldClassName} {...register("location.addressLine")} />
                  <FieldError id="edit-addressLine-error" message={errors.location?.addressLine?.message} />
                </div>
                <div>
                  <label htmlFor="edit-addressNumber" className="text-sm font-semibold text-slate-800">
                    Número
                  </label>
                  <input id="edit-addressNumber" type="text" maxLength={32} aria-invalid={Boolean(errors.location?.addressNumber)} aria-describedby={errors.location?.addressNumber ? "edit-addressNumber-error" : undefined} className={fieldClassName} {...register("location.addressNumber")} />
                  <FieldError id="edit-addressNumber-error" message={errors.location?.addressNumber?.message} />
                </div>
                <div>
                  <label htmlFor="edit-addressComplement" className="text-sm font-semibold text-slate-800">
                    Complemento <span className="font-normal text-slate-500">(opcional)</span>
                  </label>
                  <input id="edit-addressComplement" type="text" maxLength={255} autoComplete="address-line2" aria-invalid={Boolean(errors.location?.addressComplement)} aria-describedby={errors.location?.addressComplement ? "edit-addressComplement-error" : undefined} className={fieldClassName} {...register("location.addressComplement")} />
                  <FieldError id="edit-addressComplement-error" message={errors.location?.addressComplement?.message} />
                </div>
              </div>
            </fieldset>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={isSubmitting} onClick={() => setIsEditing(false)} className="inline-flex min-h-12 items-center justify-center px-5 py-3 font-semibold text-slate-700 hover:text-slate-950 disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={isSubmitting || !canEdit || categoriesState !== "success"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isSubmitting ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Save aria-hidden="true" className="size-5" />}
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        ) : null}

        {!isEditing && request.status === "DRAFT" ? (
          <section aria-labelledby="draft-information-title" className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <ClipboardCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-700" />
              <div>
                <h2 id="draft-information-title" className="font-bold text-blue-950">
                  Informações do rascunho
                </h2>
                <p className="mt-2 leading-7 text-blue-900/80">Esta solicitação está salva como rascunho e ainda não foi publicada.</p>
              </div>
            </div>
          </section>
        ) : null}

        {!isEditing && request.description ? (
          <section aria-labelledby="request-description-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="size-5 text-blue-600" />
              <h2 id="request-description-title" className="text-xl font-bold text-slate-950">
                Descrição
              </h2>
            </div>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{request.description}</p>
          </section>
        ) : null}

        {!isEditing ? (
          <section aria-labelledby="received-proposals-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 id="received-proposals-title" className="text-xl font-bold text-slate-950">Propostas recebidas</h2>
                <p className="mt-1 text-sm text-slate-600">Compare as condições enviadas para esta solicitação.</p>
              </div>
              {proposalsState !== "idle" && proposalsState !== "loading" ? <p className="text-sm text-slate-600">Página {proposals?.pagination.page ?? proposalsPage} de {proposalsTotalPages}</p> : null}
            </div>

            {proposalsState === "loading" ? (
              <div className="flex items-center gap-3 py-10 text-slate-700">
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
                <p className="text-sm font-medium">Carregando propostas...</p>
              </div>
            ) : null}

            {proposalsState === "error" || proposalsState === "unauthorized" || proposalsState === "forbidden" ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
                <p className="text-sm font-medium leading-6 text-red-700">
                  {proposalsState === "unauthorized" ? "Sua sessão expirou. Entre novamente para consultar as propostas." : proposalsState === "forbidden" ? "Sua conta não possui permissão para consultar estas propostas." : "Não foi possível carregar as propostas. Tente novamente."}
                </p>
                <button type="button" onClick={() => void loadProposals(proposalsPage)} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                  Tentar novamente
                </button>
              </div>
            ) : null}

            {proposalsState === "empty" ? <p className="py-10 text-sm leading-6 text-slate-600">Ainda não há propostas para esta solicitação.</p> : null}

            {proposalsState === "success" && proposals ? (
              <>
                <div className="mt-5 grid gap-4">
                  {proposals.items.map((proposal) => (
                    <article key={proposal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-2xl font-bold text-slate-950">{formatProposalAmount(proposal.amountInCents)}</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${proposalStatusTones[proposal.status]}`}>{proposalStatusLabels[proposal.status]}</span>
                      </div>
                      <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                        <div><dt className="font-medium text-slate-500">Prazo estimado</dt><dd className="mt-1">{formatProposalDuration(proposal.estimatedDurationValue, proposal.estimatedDurationUnit)}</dd></div>
                        <div><dt className="font-medium text-slate-500">Enviada em</dt><dd className="mt-1">{formatProposalDate(proposal.submittedAt)}</dd></div>
                      </dl>
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Mensagem</p>
                        <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{proposal.message}</p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => setProposalsPage((currentPage) => Math.max(1, currentPage - 1))} disabled={proposalsIsFirstPage} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
                  <p className="text-sm text-slate-600">Página {proposals.pagination.page} de {proposalsTotalPages}</p>
                  <button type="button" onClick={() => setProposalsPage((currentPage) => currentPage + 1)} disabled={proposalsIsLastPage} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {!isEditing ? (
          <section aria-labelledby="request-location-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <MapPin aria-hidden="true" className="size-5 text-blue-600" />
              <h2 id="request-location-title" className="text-xl font-bold text-slate-950">
                Localização
              </h2>
            </div>
            <address className="mt-4 space-y-1 not-italic leading-7 text-slate-700">
              <p>
                {location.addressLine}, {location.addressNumber}
              </p>
              {location.addressComplement ? <p>{location.addressComplement}</p> : null}
              <p>{location.neighborhood}</p>
              <p>
                {location.city}, {location.state}
              </p>
              <p>CEP {location.postalCode}</p>
              <p>{location.country}</p>
            </address>
          </section>
        ) : null}
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
  const toneClassName = state === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : state === "error" ? "border-red-200 bg-red-50 text-red-950" : "border-slate-200 bg-white text-slate-700";

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
              {action ? (
                <Link href={action.href} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                  {action.label}
                </Link>
              ) : null}
              {onRetry ? (
                <button type="button" onClick={() => void onRetry()} className="mt-6 font-semibold underline underline-offset-4">
                  Tentar novamente
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
