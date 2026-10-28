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

import {
  contractCustomerReviewUrl,
  contractStartUrl,
  opportunityByIdUrl,
  opportunityPreProposalConversationMessagesUrl,
  opportunityPreProposalConversationsUrl,
  opportunityViewedUrl,
  preProposalConversationMessagesUrl,
} from "../../lib/api";
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

type ContractStatus =
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

interface OpportunityPhoto {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  url: string;
}

interface ReviewSummary {
  rating: number;
  comment: string | null;
  publishedAt: string | null;
}

interface OpportunityDetails {
  opportunityId: string;
  createdAt: string;
  viewedAt: string | null;
  conversationId: string | null;
  customerFirstName: string | null;
  contract: {
    id: string;
    status: ContractStatus;
    completedAt: string | null;
    review: ReviewSummary | null;
    customerReview: ReviewSummary | null;
  } | null;
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

interface PreProposalMessage {
  id: string;
  senderUserId: string;
  content: string;
  sentAt: string;
}

interface PreProposalRequestSummary { id: string; status: "CLOSED" | "AWAITING_RESPONSE"; messages: Array<PreProposalMessage & { responsePhotos?: Array<{ id: string; originalName: string; url: string }> }>; }

const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DETAIL_REQUEST_OPTIONS = [
  "Mais detalhes sobre o serviço",
  "Fotos do local ou do problema",
  "Medidas ou quantidade",
  "Prazo desejado",
  "Outra dúvida",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function parsePreProposalMessage(value: unknown): PreProposalMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.senderUserId !== "string" ||
    typeof value.content !== "string" ||
    typeof value.sentAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    senderUserId: value.senderUserId,
    content: value.content,
    sentAt: value.sentAt,
  };
}

function responseData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  return isRecord(payload.data) ? payload.data : payload;
}

function parseStartedPreProposalConversation(payload: unknown): {
  conversationId: string;
  message: PreProposalMessage | null;
} | null {
  const root = responseData(payload);

  if (!root || typeof root.conversationId !== "string") {
    return null;
  }

  if (root.message === null) {
    return { conversationId: root.conversationId, message: null };
  }

  const message = parsePreProposalMessage(root.message);
  return message ? { conversationId: root.conversationId, message } : null;
}

function parseSentPreProposalMessage(payload: unknown): PreProposalMessage | null {
  const root = responseData(payload);
  return root ? parsePreProposalMessage(root.message) : null;
}

function parsePreProposalMessages(payload: unknown): PreProposalMessage[] | null {
  const root = responseData(payload);

  if (!root || !Array.isArray(root.items)) {
    return null;
  }

  const messages: PreProposalMessage[] = [];

  for (const item of root.items) {
    const message = parsePreProposalMessage(item);
    if (!message) {
      return null;
    }
    messages.push(message);
  }

  return messages;
}

function isContractStatus(value: unknown): value is ContractStatus {
  return (
    value === "ACCEPTED" ||
    value === "IN_PROGRESS" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  );
}

function isReviewWindowOpen(completedAt: string | null): boolean {
  if (!completedAt) {
    return false;
  }

  const completedAtMs = new Date(completedAt).getTime();

  if (Number.isNaN(completedAtMs)) {
    return false;
  }

  return Date.now() < completedAtMs + REVIEW_WINDOW_MS;
}

function parseReviewSummary(value: unknown): ReviewSummary | null | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.rating !== "number" ||
    !isNullableString(value.comment) ||
    !isNullableString(value.publishedAt)
  ) {
    return undefined;
  }

  return {
    rating: value.rating,
    comment: value.comment,
    publishedAt: value.publishedAt,
  };
}

function parseContract(
  value: unknown,
): OpportunityDetails["contract"] | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.id !== "string" ||
    !isContractStatus(value.status) ||
    !isNullableString(value.completedAt)
  ) {
    return undefined;
  }

  const review = parseReviewSummary(value.review);
  const customerReview = parseReviewSummary(value.customerReview);

  if (review === undefined || customerReview === undefined) {
    return undefined;
  }

  return {
    id: value.id,
    status: value.status,
    completedAt: value.completedAt,
    review,
    customerReview,
  };
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
  const contract = parseContract(root.contract);

  if (
    typeof root.opportunityId !== "string" ||
    typeof root.createdAt !== "string" ||
    !isNullableString(root.viewedAt) ||
    !isNullableString(root.conversationId) ||
    !isNullableString(root.customerFirstName) ||
    contract === undefined ||
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

  const rawPhotos = Array.isArray(serviceRequest.photos)
    ? serviceRequest.photos
    : [];

  const photos: OpportunityPhoto[] = [];

  for (const photo of rawPhotos) {
    if (
      !isRecord(photo) ||
      typeof photo.id !== "string" ||
      typeof photo.originalName !== "string" ||
      typeof photo.mimeType !== "string" ||
      typeof photo.sizeBytes !== "number" ||
      !Number.isInteger(photo.sizeBytes) ||
      photo.sizeBytes < 0 ||
      typeof photo.position !== "number" ||
      !Number.isInteger(photo.position) ||
      photo.position < 0 ||
      typeof photo.url !== "string"
    ) {
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
    contract,
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
      photos: [...photos].sort(
        (first, second) => first.position - second.position,
      ),
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
  const [lightboxImage, setLightboxImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [isStartingContract, setIsStartingContract] = useState(false);
  const [contractActionMessage, setContractActionMessage] = useState<
    string | null
  >(null);
  const [customerReviewRating, setCustomerReviewRating] = useState(5);
  const [customerReviewComment, setCustomerReviewComment] = useState("");
  const [isSubmittingCustomerReview, setIsSubmittingCustomerReview] =
    useState(false);
  const [customerReviewError, setCustomerReviewError] = useState<string | null>(
    null,
  );
  const [preProposalConversationId, setPreProposalConversationId] = useState<string | null>(null);
  const [preProposalMessage, setPreProposalMessage] = useState("");
  const [selectedDetailOptions, setSelectedDetailOptions] = useState<string[]>([]);
  const [otherDetailQuestion, setOtherDetailQuestion] = useState("");
  const [isSendingPreProposalMessage, setIsSendingPreProposalMessage] = useState(false);
  const [preProposalMessageFeedback, setPreProposalMessageFeedback] = useState<string | null>(null);
  const [preProposalMessages, setPreProposalMessages] = useState<PreProposalMessage[]>([]);
  const [preProposalRequests, setPreProposalRequests] = useState<PreProposalRequestSummary[]>([]);
  const [isLoadingPreProposalMessages, setIsLoadingPreProposalMessages] = useState(false);

  const viewedOpportunityIdRef = useRef<string | null>(null);
  const preProposalRequestRef = useRef<string | null>(null);
  const preProposalConversationIdRef = useRef<string | null>(null);
  const preProposalHistoryRequestRef = useRef(0);
  const preProposalSendRequestRef = useRef<number | null>(null);
  const preProposalSendSequenceRef = useRef(0);
  const restoredPreProposalStorageKeyRef = useRef<string | null>(null);

  const isProfessional = Boolean(user?.roles.includes("PROFESSIONAL"));
  const preProposalScopeKey = `${opportunityId}:${user?.id ?? "anonymous"}`;
  const preProposalSessionKey = `${preProposalScopeKey}:${accessToken ?? ""}`;
  const preProposalStorageKey = `soravi:pre-proposal-conversation:${opportunityId}:${user?.id ?? "anonymous"}`;

  preProposalRequestRef.current = preProposalSessionKey;

  useEffect(() => {
    preProposalRequestRef.current = preProposalSessionKey;
    preProposalConversationIdRef.current = null;
    preProposalHistoryRequestRef.current += 1;
    preProposalSendRequestRef.current = null;
    setPreProposalConversationId(null);
    setPreProposalMessages([]);
    setPreProposalMessage("");
    setSelectedDetailOptions([]);
    setOtherDetailQuestion("");
    setPreProposalMessageFeedback(null);
    setIsSendingPreProposalMessage(false);
    setIsLoadingPreProposalMessages(false);
  }, [preProposalScopeKey]);

  useEffect(() => {
    if (!isAuthenticated || !isProfessional || !accessToken) {
      return;
    }

    if (restoredPreProposalStorageKeyRef.current === preProposalStorageKey) {
      return;
    }

    restoredPreProposalStorageKeyRef.current = preProposalStorageKey;

    let storedConversationId: string | null;

    try {
      storedConversationId = window.sessionStorage.getItem(preProposalStorageKey);
    } catch {
      return;
    }

    if (!storedConversationId) {
      return;
    }

    preProposalConversationIdRef.current = storedConversationId;
    setPreProposalConversationId(storedConversationId);
  }, [accessToken, isAuthenticated, isProfessional, preProposalStorageKey]);

  useEffect(() => {
    if (!accessToken || !preProposalConversationId) {
      return;
    }

    const requestKey = preProposalSessionKey;
    const conversationId = preProposalConversationId;
    const historyRequestId = preProposalHistoryRequestRef.current + 1;
    preProposalHistoryRequestRef.current = historyRequestId;
    setIsLoadingPreProposalMessages(true);

    async function loadPreProposalMessages(): Promise<void> {
      try {
        const response = await fetch(preProposalConversationMessagesUrl(conversationId), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);
        const messages = response.ok ? parsePreProposalMessages(payload) : null;

        if (
          preProposalRequestRef.current !== requestKey ||
          preProposalConversationIdRef.current !== conversationId ||
          preProposalHistoryRequestRef.current !== historyRequestId
        ) {
          return;
        }

        if (!messages) {
          setPreProposalMessageFeedback("Não foi possível carregar a conversa agora.");
          return;
        }

        setPreProposalMessages(messages);
      } catch {
        if (
          preProposalRequestRef.current === requestKey &&
          preProposalConversationIdRef.current === conversationId &&
          preProposalHistoryRequestRef.current === historyRequestId
        ) {
          setPreProposalMessageFeedback("Não foi possível carregar a conversa agora.");
        }
      } finally {
        if (
          preProposalRequestRef.current === requestKey &&
          preProposalConversationIdRef.current === conversationId &&
          preProposalHistoryRequestRef.current === historyRequestId
        ) {
          setIsLoadingPreProposalMessages(false);
        }
      }
    }

    void loadPreProposalMessages();
  }, [accessToken, preProposalConversationId, preProposalSessionKey]);

  useEffect(() => {
    if (!accessToken || !isProfessional) return;
    let active = true;
    void fetch(opportunityPreProposalConversationsUrl(opportunityId), { headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? responseData(await response.json().catch(() => null)) : null)
      .then((data) => { if (active && data && Array.isArray(data.items)) setPreProposalRequests(data.items as PreProposalRequestSummary[]); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [accessToken, isProfessional, opportunityId, preProposalConversationId]);

  const loadOpportunity = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setOpportunityState("loading");

    try {
      const response = await fetch(opportunityByIdUrl(opportunityId), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
        const response = await fetch(opportunityViewedUrl(viewedOpportunityId), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          return;
        }

        const markedOpportunity = parseOpportunityDetails(payload);

        if (markedOpportunity) {
          setOpportunity(markedOpportunity);
        }
      } catch {
        // A leitura permanece disponível se a marcação de visualização falhar.
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

  const contract = opportunity.contract;

  const reviewWindowOpen =
    contract?.status === "COMPLETED"
      ? isReviewWindowOpen(contract.completedAt)
      : false;

  const receivedReview = contract?.review ?? null;
  const ownCustomerReview = contract?.customerReview ?? null;

  const receivedReviewIsPublished = receivedReview?.publishedAt != null;

  async function startContract(): Promise<void> {
    if (
      !accessToken ||
      !contract ||
      isStartingContract ||
      !window.confirm("Deseja iniciar este serviço?")
    ) {
      return;
    }

    setIsStartingContract(true);
    setContractActionMessage(null);

    try {
      const response = await fetch(contractStartUrl(contract.id), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("contract start failed");
      }

      setOpportunity((current) =>
        current?.contract
          ? {
            ...current,
            contract: {
              ...current.contract,
              status: "IN_PROGRESS",
            },
          }
          : current,
      );

      setContractActionMessage("Serviço iniciado com sucesso.");
    } catch {
      setContractActionMessage(
        "Não foi possível iniciar o serviço. Tente novamente.",
      );
    } finally {
      setIsStartingContract(false);
    }
  }

  async function submitCustomerReview(): Promise<void> {
    if (!contract || !accessToken || isSubmittingCustomerReview) {
      return;
    }

    setIsSubmittingCustomerReview(true);
    setCustomerReviewError(null);

    try {
      const response = await fetch(contractCustomerReviewUrl(contract.id), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          rating: customerReviewRating,
          ...(customerReviewComment.trim()
            ? { comment: customerReviewComment.trim() }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("customer review failed");
      }

      await loadOpportunity();
    } catch {
      setCustomerReviewError("Não foi possível enviar a avaliação agora.");
    } finally {
      setIsSubmittingCustomerReview(false);
    }
  }

  async function sendPreProposalMessage(): Promise<void> {
    const otherSelected = selectedDetailOptions.includes("Outra dúvida");
    const selected = selectedDetailOptions.filter((option) => option !== "Outra dúvida");
    const content = [
      selected.length ? `Gostaria de esclarecimentos sobre:\n- ${selected.join("\n- ")}` : "",
      otherSelected ? `Outra dúvida:\n${otherDetailQuestion.trim()}` : "",
    ].filter(Boolean).join("\n\n");
    const currentOpportunityId = opportunity?.opportunityId;
    if (
      !accessToken ||
      !currentOpportunityId ||
      !content ||
      isSendingPreProposalMessage ||
      preProposalSendRequestRef.current !== null
    ) {
      return;
    }

    const requestKey = preProposalSessionKey;
    // Cada envio abre um pedido independente; nunca reutiliza um histórico como chat.
    const currentConversationId: string | null = null;
    const sendRequestId = preProposalSendSequenceRef.current + 1;
    preProposalSendSequenceRef.current = sendRequestId;
    preProposalSendRequestRef.current = sendRequestId;
    setIsSendingPreProposalMessage(true);
    setPreProposalMessageFeedback(null);

    try {
      const response = await fetch(
        opportunityPreProposalConversationMessagesUrl(currentOpportunityId),
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ content }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error("pre-proposal message failed");
      }

      if (preProposalRequestRef.current !== requestKey) {
        return;
      }

      if (!currentConversationId) {
        const startedConversation = parseStartedPreProposalConversation(payload);

        if (!startedConversation) {
          throw new Error("invalid pre-proposal start response");
        }

        preProposalConversationIdRef.current = startedConversation.conversationId;
        setPreProposalConversationId(startedConversation.conversationId);
        try {
          window.sessionStorage.setItem(
            preProposalStorageKey,
            startedConversation.conversationId,
          );
        } catch {
          // A conversa continua disponível nesta página mesmo sem armazenamento da sessão.
        }
        setPreProposalMessages(
          startedConversation.message ? [startedConversation.message] : [],
        );
        setPreProposalMessageFeedback(
          startedConversation.message === null
            ? "A conversa já estava aberta. Agora você pode enviar uma nova mensagem."
            : "Mensagem enviada ao cliente.",
        );
        if (startedConversation.message) {
      setPreProposalMessage("");
      setSelectedDetailOptions([]);
      setOtherDetailQuestion("");
        }
      } else {
        const sentMessage = parseSentPreProposalMessage(payload);

        if (!sentMessage) {
          throw new Error("invalid pre-proposal send response");
        }

        preProposalHistoryRequestRef.current += 1;
        setPreProposalMessages((messages) =>
          messages.some((message) => message.id === sentMessage.id)
            ? messages
            : [...messages, sentMessage],
        );
        setPreProposalMessageFeedback("Mensagem enviada ao cliente.");
        setPreProposalMessage("");
      }
    } catch {
      if (preProposalRequestRef.current === requestKey) {
        setPreProposalMessageFeedback(
          "Não foi possível enviar a mensagem agora. Tente novamente.",
        );
      }
    } finally {
      if (preProposalSendRequestRef.current === sendRequestId) {
        preProposalSendRequestRef.current = null;
        setIsSendingPreProposalMessage(false);
      }
    }
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link
          href="/profissional/oportunidades"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
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
              <span
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.className}`}
              >
                {status.label}
              </span>

              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${isUnviewed
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
              >
                {isUnviewed ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
                {isUnviewed ? "Não visualizada" : "Visualizada"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays
              aria-hidden="true"
              className="size-4 text-slate-400"
            />
            Recebida em {formatServiceRequestDate(opportunity.createdAt)}
          </div>

          {typeof opportunity.conversationId === "string" ? (
            <Link
              href={`/conversas/${opportunity.conversationId}`}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              Ir para conversa
            </Link>
          ) : null}

          {contract ? (
            <section
              className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"
              aria-live="polite"
            >
              <p className="font-semibold text-blue-950">
                {contract.status === "ACCEPTED"
                  ? "Contratação aceita"
                  : contract.status === "IN_PROGRESS"
                    ? "Serviço em andamento"
                    : contract.status === "COMPLETED"
                      ? "Serviço concluído"
                      : "Contratação cancelada"}
              </p>

              {contract.status === "ACCEPTED" ? (
                <button
                  type="button"
                  onClick={() => void startContract()}
                  disabled={isStartingContract}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isStartingContract ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}

                  {isStartingContract ? "Iniciando..." : "Iniciar serviço"}
                </button>
              ) : null}

              {contractActionMessage ? (
                <p
                  className={`mt-3 text-sm font-medium ${contractActionMessage === "Serviço iniciado com sucesso."
                      ? "text-emerald-700"
                      : "text-red-700"
                    }`}
                  role={
                    contractActionMessage === "Serviço iniciado com sucesso."
                      ? "status"
                      : "alert"
                  }
                >
                  {contractActionMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          {contract?.status === "COMPLETED" &&
            receivedReview &&
            !receivedReviewIsPublished ? (
            <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="font-semibold text-amber-950">
                Avaliação recebida
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                Uma avaliação já foi enviada. Ela ficará visível quando você
                também avaliar ou quando o período de avaliação terminar.
              </p>
            </section>
          ) : null}

          {contract?.status === "COMPLETED" &&
            receivedReview &&
            receivedReviewIsPublished ? (
            <section
              className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
              aria-labelledby="customer-review-title"
            >
              <h2
                id="customer-review-title"
                className="font-semibold text-emerald-950"
              >
                Avaliação recebida do cliente
              </h2>
              <p className="mt-2 text-sm font-medium text-emerald-900">
                Nota: {receivedReview.rating} de 5
              </p>
              {receivedReview.comment ? (
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  “{receivedReview.comment}”
                </p>
              ) : null}
            </section>
          ) : null}

          {contract?.status === "COMPLETED" && ownCustomerReview ? (
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="font-semibold text-slate-950">
                Sua avaliação do cliente
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                Nota: {ownCustomerReview.rating} de 5
              </p>
              {ownCustomerReview.comment ? (
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {ownCustomerReview.comment}
                </p>
              ) : null}
            </section>
          ) : null}

          {contract?.status === "COMPLETED" &&
            !ownCustomerReview &&
            reviewWindowOpen ? (
            <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h2 className="font-semibold text-blue-950">Avaliar cliente</h2>

              <label
                className="mt-3 block text-sm"
                htmlFor="customer-review-rating"
              >
                Nota
              </label>

              <select
                id="customer-review-rating"
                value={customerReviewRating}
                onChange={(event) =>
                  setCustomerReviewRating(Number(event.target.value))
                }
                disabled={isSubmittingCustomerReview}
                className="mt-1 min-h-11 rounded-lg border border-slate-300 bg-white px-3"
              >
                <option value={5}>5 - Excelente</option>
                <option value={4}>4 - Muito bom</option>
                <option value={3}>3 - Bom</option>
                <option value={2}>2 - Regular</option>
                <option value={1}>1 - Ruim</option>
              </select>

              <label
                className="mt-3 block text-sm"
                htmlFor="customer-review-comment"
              >
                Comentário opcional
              </label>

              <textarea
                id="customer-review-comment"
                value={customerReviewComment}
                onChange={(event) =>
                  setCustomerReviewComment(event.target.value)
                }
                maxLength={1000}
                disabled={isSubmittingCustomerReview}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-3"
                rows={3}
              />

              <button
                type="button"
                onClick={() => void submitCustomerReview()}
                disabled={isSubmittingCustomerReview}
                className="mt-3 min-h-11 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {isSubmittingCustomerReview
                  ? "Enviando..."
                  : "Enviar avaliação"}
              </button>

              {customerReviewError ? (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {customerReviewError}
                </p>
              ) : null}
            </section>
          ) : null}

          {contract?.status === "COMPLETED" &&
            !ownCustomerReview &&
            !reviewWindowOpen ? (
            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-700">
                O período para avaliar este serviço foi encerrado.
              </p>
            </section>
          ) : null}
        </header>

        {serviceRequest.description ? (
          <section
            aria-labelledby="opportunity-description-title"
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <div className="flex items-center gap-3">
              <FileText
                aria-hidden="true"
                className="size-5 text-blue-600"
              />
              <h2
                id="opportunity-description-title"
                className="text-xl font-bold text-slate-950"
              >
                Descrição do serviço
              </h2>
            </div>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
              {serviceRequest.description}
            </p>
          </section>
        ) : null}

        {serviceRequest.photos.length > 0 ? (
          <section
            aria-labelledby="opportunity-photos-title"
            className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <h2
              id="opportunity-photos-title"
              className="text-xl font-bold text-slate-950"
            >
              Fotos
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceRequest.photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={`Ampliar imagem ${photo.originalName}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  onClick={() =>
                    setLightboxImage({
                      src: photo.url,
                      alt: photo.originalName,
                    })
                  }
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

        <ImageLightbox
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />

        <section
          aria-labelledby="opportunity-location-title"
          className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="flex items-center gap-3">
            <MapPin aria-hidden="true" className="size-5 text-blue-600" />
            <h2
              id="opportunity-location-title"
              className="text-xl font-bold text-slate-950"
            >
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
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="pre-proposal-contact-title">
            <div className="flex items-center gap-3">
              <MessageCircle aria-hidden="true" className="size-5 text-blue-600" />
              <h2 id="pre-proposal-contact-title" className="text-xl font-bold text-slate-950">
                Pedir mais detalhes
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Envie uma pergunta privada. Cada pedido recebe uma única resposta e não funciona como chat.
            </p>
            {false && isLoadingPreProposalMessages ? (
              <p className="mt-4 text-sm text-slate-600">Carregando conversa...</p>
            ) : null}
            {false && preProposalMessages.length > 0 ? (
              <ol className="mt-4 space-y-3" aria-label="Mensagens da conversa">
                {preProposalMessages.map((message) => (
                  <li key={message.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                    <p className="font-semibold text-slate-700">
                      {message.senderUserId === user?.id ? "Você" : "Cliente"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                  </li>
                ))}
              </ol>
            ) : null}
            {preProposalRequests.length > 0 ? <ol className="mt-4 space-y-3" aria-label="Pedidos de esclarecimento">{preProposalRequests.map((request) => <li key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"><p className="font-semibold">{request.status === "CLOSED" ? "Encerrado" : "Aguardando resposta"}</p>{request.messages.map((message, index) => <div key={message.id} className="mt-2"><p className="font-medium text-slate-700">{index === 0 ? "Sua pergunta" : "Resposta do cliente"}</p><p className="whitespace-pre-wrap">{message.content}</p>{message.responsePhotos?.map((photo) => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold text-blue-700">{photo.originalName}</a>)}</div>)}</li>)}</ol> : null}
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-800">O que você precisa esclarecer?</legend>
              <div className="mt-2 space-y-2">{DETAIL_REQUEST_OPTIONS.map((option) => <label key={option} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selectedDetailOptions.includes(option)} disabled={isSendingPreProposalMessage} onChange={(event) => setSelectedDetailOptions((current) => event.target.checked ? [...current, option] : current.filter((item) => item !== option))} />{option}</label>)}</div>
              {selectedDetailOptions.includes("Outra dúvida") ? <><label className="mt-3 block text-sm font-medium text-slate-800" htmlFor="pre-proposal-other-question">Descreva sua dúvida</label><textarea id="pre-proposal-other-question" value={otherDetailQuestion} onChange={(event) => setOtherDetailQuestion(event.target.value)} required maxLength={4000} rows={3} disabled={isSendingPreProposalMessage} className="mt-1 block w-full rounded-xl border border-slate-300 p-3 text-slate-900" /></> : null}
            </fieldset>
            <button
              type="button"
              onClick={() => void sendPreProposalMessage()}
              disabled={!selectedDetailOptions.length || (selectedDetailOptions.includes("Outra dúvida") && !otherDetailQuestion.trim()) || isSendingPreProposalMessage}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSendingPreProposalMessage ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <MessageCircle aria-hidden="true" className="size-4" />}
              Pedir esclarecimento
            </button>
            {preProposalMessageFeedback ? (
              <p role="status" className="mt-3 text-sm font-medium text-slate-700">{preProposalMessageFeedback}</p>
            ) : null}
          </section>
        ) : null}

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

function StatePage({
  state,
  title,
  description,
  action,
  onRetry,
}: StatePageProps) {
  const toneClassName =
    state === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : state === "error"
        ? "border-red-200 bg-red-50 text-red-950"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <section
          role={state === "error" ? "alert" : undefined}
          aria-live={state === "loading" ? "polite" : undefined}
          className={`rounded-2xl border p-6 shadow-sm sm:p-8 ${toneClassName}`}
        >
          <div className="flex items-start gap-3">
            {state === "loading" ? (
              <Loader2
                aria-hidden="true"
                className="mt-1 size-5 shrink-0 animate-spin"
              />
            ) : null}

            {state === "error" ? (
              <ShieldAlert
                aria-hidden="true"
                className="mt-1 size-5 shrink-0"
              />
            ) : null}

            <div>
              <h1 className="text-2xl font-bold">{title}</h1>

              {description ? (
                <p className="mt-3 leading-7 opacity-80">{description}</p>
              ) : null}

              {action ? (
                <Link
                  href={action.href}
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  {action.label}
                </Link>
              ) : null}

              {onRetry ? (
                <button
                  type="button"
                  onClick={() => void onRetry()}
                  className="mt-6 font-semibold underline underline-offset-4"
                >
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
