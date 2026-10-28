"use client";

import { Loader2, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  preProposalConversationMessagesUrl,
  preProposalConversationResponseUrl,
  serviceRequestPreProposalConversationsUrl,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";
import type { ServiceRequestStatus } from "./service-request-presentation";

const PAGE_SIZE = 20;
const MESSAGE_LIMIT = 30;

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden";

interface ConversationItem {
  id: string;
  updatedAt: string;
  professional: {
    id: string;
    displayName: string | null;
  };
}

interface ResponsePhoto {
  id: string;
  originalName: string;
  url: string;
}

interface PreProposalMessage {
  id: string;
  senderUserId: string;
  content: string;
  sentAt: string;
  responsePhotos?: ResponsePhoto[];
}

interface ParsedMessages {
  items: PreProposalMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function responseData(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null;
  }

  return isRecord(payload.data) ? payload.data : payload;
}

function parseConversations(
  payload: unknown,
): { items: ConversationItem[]; total: number } | null {
  const root = responseData(payload);
  if (!root || !Array.isArray(root.items) || typeof root.total !== "number") {
    return null;
  }

  const items: ConversationItem[] = [];
  for (const item of root.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.updatedAt !== "string" ||
      !isRecord(item.professional) ||
      typeof item.professional.id !== "string" ||
      (typeof item.professional.displayName !== "string" &&
        item.professional.displayName !== null)
    ) {
      return null;
    }

    items.push({
      id: item.id,
      updatedAt: item.updatedAt,
      professional: {
        id: item.professional.id,
        displayName: item.professional.displayName,
      },
    });
  }

  return { items, total: root.total };
}

function parseMessage(value: unknown): PreProposalMessage | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.senderUserId !== "string" ||
    typeof value.content !== "string" ||
    typeof value.sentAt !== "string"
  ) {
    return null;
  }

  const photos = Array.isArray(value.responsePhotos)
    ? value.responsePhotos
    : [];
  if (
    !photos.every(
      (photo) =>
        isRecord(photo) &&
        typeof photo.id === "string" &&
        typeof photo.originalName === "string" &&
        typeof photo.url === "string",
    )
  ) {
    return null;
  }

  return {
    id: value.id,
    senderUserId: value.senderUserId,
    content: value.content,
    sentAt: value.sentAt,
    responsePhotos: photos as ResponsePhoto[],
  };
}

function parseMessages(payload: unknown): ParsedMessages | null {
  const root = responseData(payload);
  if (
    !root ||
    !Array.isArray(root.items) ||
    typeof root.hasMore !== "boolean" ||
    (typeof root.nextCursor !== "string" && root.nextCursor !== null)
  ) {
    return null;
  }

  const items = root.items.map(parseMessage);
  if (!items.every((item): item is PreProposalMessage => item !== null)) {
    return null;
  }

  return { items, hasMore: root.hasMore, nextCursor: root.nextCursor };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function PreProposalConversationsPanel({
  serviceRequestId,
  serviceRequestStatus,
}: {
  serviceRequestId: string;
  serviceRequestStatus: ServiceRequestStatus;
}) {
  const { accessToken, user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationsState, setConversationsState] =
    useState<LoadState>("idle");
  const [conversationPage, setConversationPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PreProposalMessage[]>([]);
  const [messagesState, setMessagesState] = useState<LoadState>("idle");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [responsePhotos, setResponsePhotos] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const scopeRef = useRef("");
  const selectedIdRef = useRef<string | null>(null);
  const conversationsRequestRef = useRef(0);
  const messagesRequestRef = useRef(0);
  const sendRequestRef = useRef(0);

  const scope = `${serviceRequestId}:${user?.id ?? "anonymous"}:${accessToken ?? ""}`;
  const writable =
    serviceRequestStatus === "OPEN" ||
    serviceRequestStatus === "RECEIVING_PROPOSALS";

  useEffect(() => {
    scopeRef.current = scope;
    selectedIdRef.current = null;
    conversationsRequestRef.current += 1;
    messagesRequestRef.current += 1;
    sendRequestRef.current += 1;
    setConversationPage(1);
    setSelectedId(null);
    setMessages([]);
    setMessagesState("idle");
    setNextCursor(null);
    setHasMore(false);
    setDraft("");
    setResponsePhotos([]);
    setSendError(null);
    setIsSending(false);
  }, [scope]);

  const loadConversations = useCallback(
    async (page: number) => {
      if (!accessToken) {
        return;
      }

      const requestId = ++conversationsRequestRef.current;
      const currentScope = scope;
      setConversationsState("loading");

      try {
        const url = new URL(
          serviceRequestPreProposalConversationsUrl(serviceRequestId),
        );
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(PAGE_SIZE));

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        });
        const parsed = response.ok
          ? parseConversations(await response.json().catch(() => null))
          : null;

        if (
          scopeRef.current !== currentScope ||
          conversationsRequestRef.current !== requestId
        ) {
          return;
        }
        if (response.status === 401) {
          setConversationsState("unauthorized");
          return;
        }
        if (response.status === 403) {
          setConversationsState("forbidden");
          return;
        }
        if (!parsed) {
          setConversationsState("error");
          return;
        }

        setConversations(parsed.items);
        setTotal(parsed.total);
        setConversationsState(parsed.items.length ? "success" : "empty");
      } catch {
        if (
          scopeRef.current === currentScope &&
          conversationsRequestRef.current === requestId
        ) {
          setConversationsState("error");
        }
      }
    },
    [accessToken, scope, serviceRequestId],
  );

  useEffect(() => {
    void loadConversations(conversationPage);
  }, [conversationPage, loadConversations]);

  const loadMessages = useCallback(
    async (
      conversationId: string,
      before?: string,
      append = false,
    ): Promise<void> => {
      if (!accessToken) {
        return;
      }

      const requestId = ++messagesRequestRef.current;
      const currentScope = scope;
      setMessagesState("loading");

      try {
        const url = new URL(preProposalConversationMessagesUrl(conversationId));
        url.searchParams.set("limit", String(MESSAGE_LIMIT));
        if (before) {
          url.searchParams.set("before", before);
        }

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          cache: "no-store",
        });
        const parsed = response.ok
          ? parseMessages(await response.json().catch(() => null))
          : null;

        if (
          scopeRef.current !== currentScope ||
          messagesRequestRef.current !== requestId ||
          selectedIdRef.current !== conversationId
        ) {
          return;
        }
        if (response.status === 401) {
          setMessagesState("unauthorized");
          return;
        }
        if (response.status === 403 || response.status === 404) {
          setMessagesState("forbidden");
          return;
        }
        if (!parsed) {
          setMessagesState("error");
          return;
        }

        setMessages((current) =>
          append ? [...parsed.items, ...current] : parsed.items,
        );
        setNextCursor(parsed.nextCursor);
        setHasMore(parsed.hasMore);
        setMessagesState("success");
      } catch {
        if (
          scopeRef.current === currentScope &&
          messagesRequestRef.current === requestId &&
          selectedIdRef.current === conversationId
        ) {
          setMessagesState("error");
        }
      }
    },
    [accessToken, scope],
  );

  function selectConversation(conversationId: string): void {
    selectedIdRef.current = conversationId;
    messagesRequestRef.current += 1;
    sendRequestRef.current += 1;
    setSelectedId(conversationId);
    setMessages([]);
    setMessagesState("loading");
    setNextCursor(null);
    setHasMore(false);
    setDraft("");
    setResponsePhotos([]);
    setSendError(null);
    setIsSending(false);

    // Também busca ao selecionar novamente o mesmo profissional.
    void loadMessages(conversationId);
  }

  function changeConversationPage(nextPage: number): void {
    selectedIdRef.current = null;
    messagesRequestRef.current += 1;
    sendRequestRef.current += 1;
    setSelectedId(null);
    setMessages([]);
    setMessagesState("idle");
    setNextCursor(null);
    setHasMore(false);
    setDraft("");
    setResponsePhotos([]);
    setSendError(null);
    setIsSending(false);
    setConversationPage(nextPage);
  }

  async function send(): Promise<void> {
    const content = draft.trim();
    if (
      !accessToken ||
      !selectedId ||
      !content ||
      isSending ||
      !writable ||
      messagesState !== "success"
    ) {
      return;
    }

    const requestId = ++sendRequestRef.current;
    const currentScope = scope;
    const conversationId = selectedId;
    setIsSending(true);
    setSendError(null);

    try {
      const form = new FormData();
      form.set("content", content);
      responsePhotos.forEach((photo) => form.append("photos", photo));

      const response = await fetch(
        preProposalConversationResponseUrl(conversationId),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: "include",
          body: form,
        },
      );
      const root = response.ok
        ? responseData(await response.json().catch(() => null))
        : null;
      const message = root ? parseMessage(root.message) : null;

      if (
        scopeRef.current !== currentScope ||
        selectedIdRef.current !== conversationId ||
        sendRequestRef.current !== requestId
      ) {
        return;
      }
      if (!message) {
        setSendError(
          response.status === 409
            ? "Este pedido foi encerrado e não aceita novas respostas."
            : "Não foi possível enviar a resposta agora.",
        );
        return;
      }

      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
      setDraft("");
      setResponsePhotos([]);
    } catch {
      if (
        scopeRef.current === currentScope &&
        selectedIdRef.current === conversationId &&
        sendRequestRef.current === requestId
      ) {
        setSendError("Não foi possível enviar a resposta agora.");
      }
    } finally {
      if (
        scopeRef.current === currentScope &&
        selectedIdRef.current === conversationId &&
        sendRequestRef.current === requestId
      ) {
        setIsSending(false);
      }
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      aria-labelledby="pre-proposal-title"
    >
      <div className="flex items-center gap-3">
        <MessageCircle aria-hidden="true" className="size-5 text-blue-600" />
        <div>
          <h2 id="pre-proposal-title" className="text-xl font-bold text-slate-950">
            Pedidos de esclarecimento
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Cada pedido é separado, recebe uma única resposta e fica
            disponível para consulta.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void loadConversations(conversationPage)}
          disabled={conversationsState === "loading"}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Atualizar contatos
        </button>
      </div>

      {conversationsState === "loading" ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-700">
          <Loader2 className="size-4 animate-spin" />
          Carregando contatos...
        </p>
      ) : null}

      {conversationsState === "empty" ? (
        <p className="mt-5 text-sm text-slate-600">
          Ainda não há contatos de profissionais para esta solicitação.
        </p>
      ) : null}

      {["error", "unauthorized", "forbidden"].includes(conversationsState) ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {conversationsState === "unauthorized"
            ? "Sua sessão expirou."
            : conversationsState === "forbidden"
              ? "Você não possui permissão para consultar estes contatos."
              : "Não foi possível carregar os contatos."}
          <button
            type="button"
            onClick={() => void loadConversations(conversationPage)}
            className="mt-3 block font-semibold underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {conversationsState === "success" ? (
        <>
          <div className="mt-5 grid gap-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`rounded-xl border p-4 text-left ${
                  selectedId === conversation.id
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="block font-semibold text-slate-950">
                  {conversation.professional.displayName ?? "Profissional"}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Última atualização: {formatDate(conversation.updatedAt)}
                </span>
              </button>
            ))}
          </div>

          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={conversationPage <= 1}
                onClick={() => changeConversationPage(conversationPage - 1)}
                className="font-semibold text-blue-700 disabled:opacity-50"
              >
                Anterior
              </button>
              <span>
                Página {conversationPage} de {pages}
              </span>
              <button
                type="button"
                disabled={conversationPage >= pages}
                onClick={() => changeConversationPage(conversationPage + 1)}
                className="font-semibold text-blue-700 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {selectedId ? (
        <div className="mt-6 border-t border-slate-200 pt-5" aria-live="polite">
          <h3 className="font-semibold text-slate-950">Pedido e resposta</h3>

          {messagesState === "loading" ? (
            <p className="mt-4 text-sm text-slate-600">Carregando pedido...</p>
          ) : null}

          {messagesState === "error" ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              Não foi possível carregar o pedido.
              <button
                type="button"
                onClick={() => void loadMessages(selectedId)}
                className="mt-3 block font-semibold underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {messagesState === "unauthorized" || messagesState === "forbidden" ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {messagesState === "unauthorized"
                ? "Sua sessão expirou."
                : "Você não possui permissão para consultar este pedido."}
            </p>
          ) : null}

          {messagesState === "success" ? (
            <>
              <div className="mt-4 space-y-3">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-xl bg-slate-50 p-3 text-sm text-slate-800"
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.responsePhotos?.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block font-semibold text-blue-700"
                      >
                        {photo.originalName}
                      </a>
                    ))}
                    <time className="mt-2 block text-xs opacity-75">
                      {formatDate(message.sentAt)}
                    </time>
                  </article>
                ))}
              </div>

              {hasMore && nextCursor ? (
                <button
                  type="button"
                  onClick={() => void loadMessages(selectedId, nextCursor, true)}
                  className="mt-3 font-semibold text-blue-700"
                >
                  Carregar mensagens anteriores
                </button>
              ) : null}

              {messages.length < 2 && writable ? (
                <div className="mt-5">
                  <label
                    htmlFor="pre-proposal-reply"
                    className="text-sm font-medium text-slate-800"
                  >
                    Sua única resposta
                  </label>
                  <textarea
                    id="pre-proposal-reply"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={isSending}
                    maxLength={4000}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 p-3 disabled:bg-slate-100"
                  />

                  <label
                    className="mt-3 block text-sm font-medium text-slate-800"
                    htmlFor="pre-proposal-photos"
                  >
                    Fotos opcionais (até 5)
                  </label>
                  <input
                    id="pre-proposal-photos"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={isSending}
                    onChange={(event) =>
                      setResponsePhotos(
                        Array.from(event.target.files ?? []).slice(0, 5),
                      )
                    }
                    className="mt-1 block text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!draft.trim() || isSending}
                    className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isSending ? "Enviando..." : "Enviar resposta e encerrar"}
                  </button>

                  {sendError ? (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                      {sendError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                  Pedido encerrado e disponível somente para consulta.
                </p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
