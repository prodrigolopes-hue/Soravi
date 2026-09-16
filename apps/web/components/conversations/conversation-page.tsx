"use client";

import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import {
  apiBaseUrl,
  conversationByIdUrl,
  conversationMessagesUrl,
  conversationReadUrl,
  contractCompleteUrl,
  contractStartUrl,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

const MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LENGTH = 4000;

type ConversationState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "unauthorized"
  | "forbidden"
  | "error";

type MessageStatus = "SENT" | "BLOCKED" | "REMOVED";
type ConversationStatus = "ACTIVE" | "CLOSED" | "BLOCKED";
type ParticipantRole = "CUSTOMER" | "PROFESSIONAL";

interface ConversationDetails {
  id: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  otherParticipantName: string | null;
  contract: {
    id: string;
    status: string;
    agreedAmountInCents: number;
    agreedDurationValue: number;
    agreedDurationUnit: string;
    acceptedAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  serviceRequest: {
    id: string;
    title: string;
    status: string;
  };
  participantRole: ParticipantRole;
}

interface ConversationMessage {
  id: string;
  senderUserId: string;
  content: string;
  status: MessageStatus;
  sentAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

interface MessagesResponse {
  data: ConversationMessage[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

interface ConversationPageProps {
  conversationId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isConversationStatus(value: unknown): value is ConversationStatus {
  return value === "ACTIVE" || value === "CLOSED" || value === "BLOCKED";
}

function isParticipantRole(value: unknown): value is ParticipantRole {
  return value === "CUSTOMER" || value === "PROFESSIONAL";
}

function isMessageStatus(value: unknown): value is MessageStatus {
  return value === "SENT" || value === "BLOCKED" || value === "REMOVED";
}

function parseConversation(payload: unknown): ConversationDetails | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (
    typeof root.id !== "string" ||
    !isConversationStatus(root.status) ||
    typeof root.createdAt !== "string" ||
    typeof root.updatedAt !== "string" ||
    !isNullableString(root.closedAt) ||
    !isNullableString(root.otherParticipantName) ||
    !isRecord(root.contract) ||
    typeof root.contract.id !== "string" ||
    typeof root.contract.status !== "string" ||
    typeof root.contract.agreedAmountInCents !== "number" ||
    typeof root.contract.agreedDurationValue !== "number" ||
    typeof root.contract.agreedDurationUnit !== "string" ||
    typeof root.contract.acceptedAt !== "string" ||
    !isNullableString(root.contract.startedAt) ||
    !isNullableString(root.contract.completedAt) ||
    !isRecord(root.serviceRequest) ||
    typeof root.serviceRequest.id !== "string" ||
    typeof root.serviceRequest.title !== "string" ||
    typeof root.serviceRequest.status !== "string" ||
    !isParticipantRole(root.participantRole)
  ) {
    return null;
  }

  return {
    id: root.id,
    status: root.status,
    createdAt: root.createdAt,
    updatedAt: root.updatedAt,
    closedAt: root.closedAt,
    otherParticipantName: root.otherParticipantName,
    contract: {
      id: root.contract.id,
      status: root.contract.status,
      agreedAmountInCents: root.contract.agreedAmountInCents,
      agreedDurationValue: root.contract.agreedDurationValue,
      agreedDurationUnit: root.contract.agreedDurationUnit,
      acceptedAt: root.contract.acceptedAt,
      startedAt: root.contract.startedAt,
      completedAt: root.contract.completedAt,
    },
    serviceRequest: {
      id: root.serviceRequest.id,
      title: root.serviceRequest.title,
      status: root.serviceRequest.status,
    },
    participantRole: root.participantRole,
  };
}

function parseMessage(value: unknown): ConversationMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.senderUserId !== "string" ||
    typeof value.content !== "string" ||
    !isMessageStatus(value.status) ||
    typeof value.sentAt !== "string" ||
    !isNullableString(value.editedAt) ||
    !isNullableString(value.deletedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    senderUserId: value.senderUserId,
    content: value.content,
    status: value.status,
    sentAt: value.sentAt,
    editedAt: value.editedAt,
    deletedAt: value.deletedAt,
  };
}

function parseMessages(payload: unknown): MessagesResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) && Array.isArray(payload.data.data)
    ? payload.data
    : payload;

  if (!Array.isArray(root.data) || !isRecord(root.meta)) {
    return null;
  }

  const messages: ConversationMessage[] = [];

  for (const item of root.data) {
    const message = parseMessage(item);

    if (!message) {
      return null;
    }

    messages.push(message);
  }

  if (
    !isNullableString(root.meta.nextCursor) ||
    typeof root.meta.hasMore !== "boolean"
  ) {
    return null;
  }

  return {
    data: messages,
    meta: {
      nextCursor: root.meta.nextCursor,
      hasMore: root.meta.hasMore,
    },
  };
}

function parseCreatedMessage(payload: unknown): ConversationMessage | null {
  if (!isRecord(payload)) {
    return null;
  }

  return parseMessage(isRecord(payload.data) ? payload.data : payload);
}

function mergeChronologicalMessages(
  existingMessages: ConversationMessage[],
  incomingMessages: ConversationMessage[],
): ConversationMessage[] {
  const byId = new Map<string, ConversationMessage>();

  for (const message of [...existingMessages, ...incomingMessages]) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((first, second) => {
    const firstTime = new Date(first.sentAt).getTime();
    const secondTime = new Date(second.sentAt).getTime();

    if (firstTime !== secondTime) {
      return firstTime - secondTime;
    }

    return first.id.localeCompare(second.id);
  });
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusMessage(status: ConversationStatus): string | null {
  if (status === "CLOSED") {
    return "Esta conversa foi encerrada. As mensagens continuam disponíveis para leitura.";
  }

  if (status === "BLOCKED") {
    return "Esta conversa está bloqueada. As mensagens continuam disponíveis para leitura.";
  }

  return null;
}

export function ConversationPage({ conversationId }: ConversationPageProps) {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>("idle");
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [contractActionState, setContractActionState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const canSend = conversation?.status === "ACTIVE";
  const trimmedMessage = messageText.trim();
  const isMessageTooLong = messageText.length > MAX_MESSAGE_LENGTH;

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !conversationId) {
      return;
    }

    const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin;
    const socket = io(`${apiOrigin}/conversations`, {
      transports: ["websocket"],
      withCredentials: true,
      auth: {
        accessToken,
      },
    });

    socketRef.current = socket;

    const handleConnect = (): void => {
      socket.emit(
        "conversation.join",
        { conversationId },
        (acknowledgement: unknown): void => {
          if (
            isRecord(acknowledgement) &&
            acknowledgement.ok === true &&
            acknowledgement.conversationId === conversationId
          ) {
            console.info("[conversation socket] join ok");
            return;
          }

          const code =
            isRecord(acknowledgement) &&
            typeof acknowledgement.code === "string"
              ? acknowledgement.code
              : "UNKNOWN";

          console.info("[conversation socket] join failed", code);
        },
      );
    };

    const handleMessageCreated = (payload: unknown): void => {
      if (!isRecord(payload)) {
        return;
      }

      const root = isRecord(payload.data) ? payload.data : payload;

      if (
        typeof root.conversationId !== "string" ||
        root.conversationId !== conversationId ||
        !isRecord(root.message)
      ) {
        return;
      }

      const incomingMessage = parseMessage(root.message);

      if (!incomingMessage) {
        return;
      }

      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === incomingMessage.id)) {
          return currentMessages;
        }

        return mergeChronologicalMessages(currentMessages, [incomingMessage]);
      });
    };

    socket.on("connect", handleConnect);
    socket.on("conversation.message.created", handleMessageCreated);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("conversation.message.created", handleMessageCreated);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [accessToken, conversationId, isAuthenticated]);

  const markVisibleMessagesAsRead = useCallback(
    async (visibleMessages: ConversationMessage[]): Promise<void> => {
      if (!accessToken || visibleMessages.length === 0) {
        return;
      }

      const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];

      try {
        await fetch(conversationReadUrl(conversationId), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            lastReadMessageId: lastVisibleMessage.id,
          }),
        });
      } catch {
        // Falha no estado de leitura não deve bloquear a conversa.
      }
    },
    [accessToken, conversationId],
  );

  const loadConversation = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setConversationState("loading");
    setSendError(null);

    try {
      const [conversationResponse, messagesResponse] = await Promise.all([
        fetch(conversationByIdUrl(conversationId), {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${conversationMessagesUrl(conversationId)}?limit=${MESSAGE_LIMIT}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (conversationResponse.status === 401 || messagesResponse.status === 401) {
        setConversation(null);
        setMessages([]);
        setConversationState("unauthorized");
        return;
      }

      if (conversationResponse.status === 403 || messagesResponse.status === 403) {
        setConversation(null);
        setMessages([]);
        setConversationState("forbidden");
        return;
      }

      if (conversationResponse.status === 404 || messagesResponse.status === 404) {
        setConversation(null);
        setMessages([]);
        setConversationState("not-found");
        return;
      }

      const [conversationPayload, messagesPayload] = await Promise.all([
        conversationResponse.json().catch(() => null),
        messagesResponse.json().catch(() => null),
      ]);

      if (!conversationResponse.ok || !messagesResponse.ok) {
        setConversation(null);
        setMessages([]);
        setConversationState("error");
        return;
      }

      const parsedConversation = parseConversation(conversationPayload);
      const parsedMessages = parseMessages(messagesPayload);

      if (!parsedConversation || !parsedMessages) {
        setConversation(null);
        setMessages([]);
        setConversationState("error");
        return;
      }

      const chronologicalMessages = mergeChronologicalMessages([], parsedMessages.data);

      setConversation(parsedConversation);
      setMessages(chronologicalMessages);
      setNextCursor(parsedMessages.meta.nextCursor);
      setHasMore(parsedMessages.meta.hasMore);
      setConversationState("success");
      void markVisibleMessagesAsRead(chronologicalMessages);
    } catch {
      setConversation(null);
      setMessages([]);
      setConversationState("error");
    }
  }, [accessToken, conversationId, markVisibleMessagesAsRead]);

  const loadOlderMessages = useCallback(async (): Promise<void> => {
    if (!accessToken || !nextCursor || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      const url = new URL(conversationMessagesUrl(conversationId));
      url.searchParams.set("before", nextCursor);
      url.searchParams.set("limit", String(MESSAGE_LIMIT));

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        return;
      }

      const parsedMessages = parseMessages(payload);

      if (!parsedMessages) {
        return;
      }

      setMessages((currentMessages) =>
        mergeChronologicalMessages(parsedMessages.data, currentMessages),
      );
      setNextCursor(parsedMessages.meta.nextCursor);
      setHasMore(parsedMessages.meta.hasMore);
    } catch {
      return;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [accessToken, conversationId, isLoadingOlder, nextCursor]);

  const sendMessage = useCallback(async (): Promise<void> => {
    if (!accessToken || !canSend || isSending) {
      return;
    }

    if (!trimmedMessage) {
      setSendError("Escreva uma mensagem antes de enviar.");
      return;
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setSendError("A mensagem deve ter no máximo 4000 caracteres.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const response = await fetch(conversationMessagesUrl(conversationId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ content: trimmedMessage }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setSendError(
          response.status === 409
            ? "Esta conversa não aceita novas mensagens."
            : "Não foi possível enviar a mensagem.",
        );
        return;
      }

      const createdMessage = parseCreatedMessage(payload);

      if (!createdMessage) {
        await loadConversation();
        setMessageText("");
        return;
      }

      setMessages((currentMessages) => {
        const nextMessages = mergeChronologicalMessages(currentMessages, [createdMessage]);
        void markVisibleMessagesAsRead(nextMessages);

        return nextMessages;
      });
      setMessageText("");
    } catch {
      setSendError("Não foi possível enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  }, [
    accessToken,
    canSend,
    conversationId,
    isSending,
    loadConversation,
    markVisibleMessagesAsRead,
    trimmedMessage,
  ]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setConversation(null);
      setMessages([]);
      setConversationState("idle");
      return;
    }

    void loadConversation();
  }, [accessToken, isAuthenticated, isLoading, loadConversation]);

  if (isLoading) {
    return <PageMessage tone="loading" title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <PageMessage
        tone="warning"
        title="Entre para acessar a conversa"
        description="Use sua conta para acompanhar as mensagens da contratação."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  if (conversationState === "loading" || conversationState === "idle") {
    return <PageMessage tone="loading" title="Carregando conversa..." />;
  }

  if (conversationState !== "success" || !conversation || !user) {
    return (
      <PageMessage
        tone="error"
        title="Não foi possível carregar a conversa"
        description={
          conversationState === "not-found"
            ? "A conversa não foi encontrada ou não está disponível para sua conta."
            : conversationState === "unauthorized"
              ? "Sua sessão expirou. Entre novamente para continuar."
              : conversationState === "forbidden"
                ? "Sua conta não possui permissão para acessar esta conversa."
                : "Tente novamente em instantes."
        }
        onRetry={conversationState === "unauthorized" ? undefined : loadConversation}
        action={conversationState === "unauthorized" ? { href: "/entrar", label: "Entrar novamente" } : undefined}
      />
    );
  }

  const readonlyMessage = statusMessage(conversation.status);

  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <Link href={conversation.participantRole === "PROFESSIONAL" ? "/profissional/oportunidades" : "/solicitacoes"} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Conversa da contratação
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {conversation.serviceRequest.title}
              </h1>
              {conversation.otherParticipantName ? (
                <p className="mt-2 text-sm text-slate-600">
                  Conversando com {conversation.otherParticipantName}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-600">
                Contratação aceita em {formatDateTime(conversation.contract.acceptedAt)}
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {conversation.status}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">Status do serviço: {conversation.contract.status === "IN_PROGRESS" ? "Em andamento" : conversation.contract.status === "COMPLETED" ? "Concluído" : "Aceito"}</p>
          {((conversation.participantRole === "PROFESSIONAL" && conversation.contract.status === "ACCEPTED") || (conversation.participantRole === "CUSTOMER" && conversation.contract.status === "IN_PROGRESS")) ? (
            <button type="button" disabled={contractActionState === "loading"} onClick={() => void (async () => {
              const start = conversation.participantRole === "PROFESSIONAL";
              if (!accessToken || !window.confirm(start ? "Deseja iniciar este serviço?" : "Deseja confirmar a conclusão deste serviço?")) return;
              setContractActionState("loading");
              try {
                const response = await fetch(start ? contractStartUrl(conversation.contract.id) : contractCompleteUrl(conversation.contract.id), { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, credentials: "include" });
                if (!response.ok) throw new Error("contract update failed");
                await loadConversation(); setContractActionState("success");
              } catch { setContractActionState("error"); }
            })()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60">
              {contractActionState === "loading" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {conversation.participantRole === "PROFESSIONAL" ? "Iniciar serviço" : "Confirmar conclusão"}
            </button>
          ) : null}
          {contractActionState === "success" ? <p className="mt-3 text-sm text-emerald-700" role="status">Contratação atualizada com sucesso.</p> : null}
          {contractActionState === "error" ? <p className="mt-3 text-sm text-red-600" role="alert">Não foi possível atualizar a contratação.</p> : null}
          {readonlyMessage ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {readonlyMessage}
            </p>
          ) : null}
        </header>

        <section className="mt-4 flex min-h-[32rem] flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Mensagens da conversa">
          <div className="border-b border-slate-200 p-3 text-center sm:p-4">
            {hasMore && nextCursor ? (
              <button type="button" onClick={() => void loadOlderMessages()} disabled={isLoadingOlder} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                {isLoadingOlder ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <RefreshCw aria-hidden="true" className="size-4" />}
                Carregar mensagens anteriores
              </button>
            ) : (
              <p className="text-sm text-slate-500">Início da conversa</p>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-slate-600">
                <MessageCircle aria-hidden="true" className="size-10 text-blue-600" />
                <h2 className="mt-4 text-xl font-bold text-slate-950">
                  Nenhuma mensagem ainda
                </h2>
                <p className="mt-2 max-w-sm leading-7">
                  Quando a conversa começar, as mensagens aparecerão aqui.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.senderUserId === user.id;

                return (
                  <article key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[72%] ${isOwnMessage ? "bg-blue-600 text-white" : "border border-slate-200 bg-slate-50 text-slate-950"}`}>
                      <p className="whitespace-pre-wrap break-words leading-7">
                        {message.content}
                      </p>
                      <p className={`mt-2 text-xs ${isOwnMessage ? "text-blue-100" : "text-slate-500"}`}>
                        {formatDateTime(message.sentAt)}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {canSend ? (
            <form className="border-t border-slate-200 p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
              <label htmlFor="message" className="sr-only">Nova mensagem</label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <textarea id="message" value={messageText} onChange={(event) => { setMessageText(event.target.value); setSendError(null); }} maxLength={MAX_MESSAGE_LENGTH} rows={3} placeholder="Escreva uma mensagem" className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100" disabled={isSending} />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{sendError ?? " "}</span>
                    <span className={isMessageTooLong ? "font-semibold text-red-600" : undefined}>
                      {messageText.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                </div>
                <button type="submit" disabled={isSending || !trimmedMessage || isMessageTooLong} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {isSending ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Send aria-hidden="true" className="size-5" />}
                  Enviar
                </button>
              </div>
              {sendError ? <p role="alert" className="mt-2 text-sm font-medium text-red-600">{sendError}</p> : null}
            </form>
          ) : (
            <div className="border-t border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
              Esta conversa está disponível apenas para leitura.
            </div>
          )}
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
  onRetry?: () => void;
}

function PageMessage({ tone, title, description, action, onRetry }: PageMessageProps) {
  const isLoadingTone = tone === "loading";

  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[28rem] max-w-3xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          {isLoadingTone ? (
            <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-blue-600" />
          ) : (
            <ShieldAlert aria-hidden="true" className="mx-auto size-8 text-red-600" />
          )}
          <h1 className="mt-4 text-2xl font-bold text-slate-950">{title}</h1>
          {description ? <p className="mt-3 leading-7 text-slate-600">{description}</p> : null}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {action ? (
              <Link href={action.href} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">
                {action.label}
              </Link>
            ) : null}
            {onRetry ? (
              <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50">
                Tentar novamente
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
