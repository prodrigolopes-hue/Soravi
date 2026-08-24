"use client";

import { ArrowRight, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  conversationsListUrl,
  type ConversationListItem,
  type ConversationsListResponse,
  type ConversationStatus,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

const PAGE_SIZE = 20;

type RequestState = "idle" | "loading" | "success" | "empty" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConversationStatus(value: unknown): value is ConversationStatus {
  return value === "ACTIVE" || value === "CLOSED" || value === "BLOCKED";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function parseConversation(value: unknown): ConversationListItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isConversationStatus(value.status) ||
    typeof value.updatedAt !== "string" ||
    !isRecord(value.serviceRequest) ||
    typeof value.serviceRequest.id !== "string" ||
    typeof value.serviceRequest.title !== "string" ||
    !isRecord(value.contract) ||
    typeof value.contract.status !== "string" ||
    typeof value.hasUnread !== "boolean"
  ) {
    return null;
  }

  let lastMessage: ConversationListItem["lastMessage"] = null;

  if (value.lastMessage !== null) {
    if (
      !isRecord(value.lastMessage) ||
      typeof value.lastMessage.id !== "string" ||
      typeof value.lastMessage.senderUserId !== "string" ||
      typeof value.lastMessage.content !== "string" ||
      typeof value.lastMessage.status !== "string" ||
      typeof value.lastMessage.sentAt !== "string"
    ) {
      return null;
    }

    lastMessage = {
      id: value.lastMessage.id,
      senderUserId: value.lastMessage.senderUserId,
      content: value.lastMessage.content,
      status: value.lastMessage.status,
      sentAt: value.lastMessage.sentAt,
    };
  }

  return {
    id: value.id,
    status: value.status,
    updatedAt: value.updatedAt,
    serviceRequest: {
      id: value.serviceRequest.id,
      title: value.serviceRequest.title,
    },
    contract: { status: value.contract.status },
    lastMessage,
    hasUnread: value.hasUnread,
  };
}

function parseResponse(payload: unknown): ConversationsListResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items) || !isRecord(root.pagination)) {
    return null;
  }

  const items: ConversationListItem[] = [];

  for (const value of root.items) {
    const item = parseConversation(value);

    if (!item) {
      return null;
    }

    items.push(item);
  }

  const { page, limit, total, totalPages } = root.pagination;

  if (
    !isPositiveInteger(page) ||
    !isPositiveInteger(limit) ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(totalPages)
  ) {
    return null;
  }

  return { items, pagination: { page, limit, total, totalPages } };
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

function statusTone(status: ConversationStatus): string {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "BLOCKED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function ConversationsListPage() {
  const { accessToken, isAuthenticated, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<ConversationsListResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");

  const loadConversations = useCallback(async (targetPage: number): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setRequestState("loading");

    try {
      const httpResponse = await fetch(conversationsListUrl(targetPage, PAGE_SIZE), {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        cache: "no-store",
      });
      const payload: unknown = await httpResponse.json().catch(() => null);

      if (!httpResponse.ok) {
        setResponse(null);
        setRequestState("error");
        return;
      }

      const parsed = parseResponse(payload);

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
  }, [accessToken]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void loadConversations(page);
  }, [accessToken, isAuthenticated, isLoading, loadConversations, page]);

  if (isLoading) {
    return <ScreenMessage loading title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <ScreenMessage
        title="Entre para acessar suas conversas"
        description="Use sua conta para acompanhar as conversas das suas contratações."
        action={{ href: "/entrar", label: "Entrar" }}
      />
    );
  }

  const totalPages = Math.max(1, response?.pagination.totalPages ?? 1);
  const currentPage = response?.pagination.page ?? page;

  return (
    <main className="bg-slate-50">
      <div className="mx-auto min-h-[calc(100vh-8rem)] max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Mensagens</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Conversas</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Acompanhe em um só lugar as conversas das suas contratações.</p>
        </header>

        <section className="mt-6" aria-live="polite" aria-busy={requestState === "loading"}>
          {requestState === "loading" || requestState === "idle" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-slate-700">
                <Loader2 aria-hidden="true" className="size-5 animate-spin text-blue-600" />
                <p className="font-medium">Carregando conversas...</p>
              </div>
            </div>
          ) : null}

          {requestState === "error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
              <div className="flex items-start gap-3">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-600" />
                <div>
                  <h2 className="font-semibold text-red-900">Não foi possível carregar as conversas</h2>
                  <p className="mt-1 text-sm leading-6 text-red-700">Tente novamente em instantes.</p>
                </div>
              </div>
              <button type="button" onClick={() => void loadConversations(page)} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
                Tentar novamente
              </button>
            </div>
          ) : null}

          {requestState === "empty" ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <MessageCircle aria-hidden="true" className="mx-auto size-10 text-blue-600" />
              <p className="mt-4 font-medium text-slate-700">Você ainda não possui conversas.</p>
            </div>
          ) : null}

          {requestState === "success" && response ? (
            <div className="space-y-4">
              {response.items.map((conversation) => (
                <article key={conversation.id} className={`rounded-2xl border p-5 shadow-sm transition-colors sm:p-6 ${conversation.hasUnread ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold text-slate-950 sm:text-xl">{conversation.serviceRequest.title}</h2>
                      <p className="mt-3 overflow-hidden text-sm leading-6 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                        {conversation.lastMessage?.content ?? "A conversa ainda não possui mensagens."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {conversation.hasUnread ? (
                        <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Nova mensagem</span>
                      ) : null}
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(conversation.status)}`}>{conversation.status}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <time dateTime={conversation.lastMessage?.sentAt ?? conversation.updatedAt} className="text-sm text-slate-500">
                      {formatDateTime(conversation.lastMessage?.sentAt ?? conversation.updatedAt)}
                    </time>
                    <Link href={`/conversas/${encodeURIComponent(conversation.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                      Abrir conversa
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </div>
                </article>
              ))}

              <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Paginação das conversas">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Anterior</button>
                <p className="text-center text-sm text-slate-600">Página {currentPage} de {totalPages}</p>
                <button type="button" onClick={() => setPage((value) => value + 1)} disabled={currentPage >= totalPages} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Próxima</button>
              </nav>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

interface ScreenMessageProps {
  loading?: boolean;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}

function ScreenMessage({ loading = false, title, description, action }: ScreenMessageProps) {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[28rem] max-w-3xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8" aria-live="polite">
          {loading ? <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-blue-600" /> : <MessageCircle aria-hidden="true" className="mx-auto size-8 text-blue-600" />}
          <h1 className="mt-4 text-2xl font-bold text-slate-950">{title}</h1>
          {description ? <p className="mt-3 leading-7 text-slate-600">{description}</p> : null}
          {action ? <Link href={action.href} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700">{action.label}</Link> : null}
        </section>
      </div>
    </main>
  );
}
