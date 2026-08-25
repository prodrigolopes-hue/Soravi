"use client";

import {
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  notificationReadUrl,
  notificationsListUrl,
  notificationsUpdatedEventName,
  parseNotificationsListResponse,
  type NotificationListItem,
  type NotificationsListResponse,
  type NotificationType,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

const PAGE_SIZE = 20;

type RequestState = "idle" | "loading" | "success" | "empty" | "error";

export function NotificationsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [response, setResponse] =
    useState<NotificationsListResponse | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [markingNotificationId, setMarkingNotificationId] = useState<
    string | null
  >(null);
  const [readErrorId, setReadErrorId] = useState<string | null>(null);

  const loadNotifications = useCallback(
    async (targetPage: number): Promise<void> => {
      if (!accessToken) {
        return;
      }

      setRequestState("loading");

      try {
        const httpResponse = await fetch(
          notificationsListUrl(targetPage, PAGE_SIZE),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: "include",
            cache: "no-store",
          },
        );
        const payload: unknown = await httpResponse.json().catch(() => null);

        if (!httpResponse.ok) {
          setResponse(null);
          setRequestState("error");
          return;
        }

        const parsed = parseNotificationsListResponse(payload);

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

    if (!isAuthenticated || !accessToken) {
      setResponse(null);
      setRequestState("idle");
      return;
    }

    void loadNotifications(page);
  }, [accessToken, isAuthenticated, isLoading, loadNotifications, page]);

  async function markAsRead(notification: NotificationListItem): Promise<boolean> {
    if (!accessToken || notification.readAt !== null) {
      return notification.readAt !== null;
    }

    setMarkingNotificationId(notification.id);
    setReadErrorId(null);

    try {
      const httpResponse = await fetch(notificationReadUrl(notification.id), {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });

      if (httpResponse.status !== 204) {
        setReadErrorId(notification.id);
        return false;
      }

      const readAt = new Date().toISOString();

      setResponse((currentResponse) =>
        currentResponse
          ? {
              ...currentResponse,
              items: currentResponse.items.map((item) =>
                item.id === notification.id ? { ...item, readAt } : item,
              ),
            }
          : currentResponse,
      );
      window.dispatchEvent(new Event(notificationsUpdatedEventName));
      return true;
    } catch {
      setReadErrorId(notification.id);
      return false;
    } finally {
      setMarkingNotificationId(null);
    }
  }

  async function openNotification(
    notification: NotificationListItem,
  ): Promise<void> {
    if (!notification.href) {
      await markAsRead(notification);
      return;
    }

    if (notification.readAt === null) {
      await markAsRead(notification);
    }

    router.push(notification.href);
  }

  if (isLoading) {
    return <PageState loading title="Carregando sua conta..." />;
  }

  if (!isAuthenticated) {
    return (
      <PageState
        title="Entre para acessar suas notificações"
        description="Use sua conta para acompanhar as novidades da Soravi."
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
          <p className="text-sm font-semibold text-blue-600">
            Central de notificações
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Notificações
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Acompanhe oportunidades, propostas e outras novidades importantes
            da sua conta.
          </p>
        </header>

        <section
          className="mt-8"
          aria-live="polite"
          aria-busy={requestState === "loading"}
        >
          {requestState === "loading" || requestState === "idle" ? (
            <InlineState loading title="Carregando notificações..." />
          ) : null}

          {requestState === "error" ? (
            <InlineState
              title="Não foi possível carregar suas notificações"
              description="Tente novamente em instantes."
              onRetry={() => void loadNotifications(page)}
            />
          ) : null}

          {requestState === "empty" ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
              <Bell
                aria-hidden="true"
                className="mx-auto size-10 text-blue-600"
              />
              <h2 className="mt-4 text-xl font-bold text-slate-950">
                Você ainda não possui notificações.
              </h2>
            </div>
          ) : null}

          {requestState === "success" && response ? (
            <>
              <div className="space-y-3">
                {response.items.map((notification) => {
                  const isUnread = notification.readAt === null;
                  const isMarking =
                    markingNotificationId === notification.id;

                  return (
                    <article
                      key={notification.id}
                      className={`rounded-2xl border p-5 shadow-sm transition-colors sm:p-6 ${
                        isUnread
                          ? "border-blue-200 bg-blue-50/70"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                              {notificationTypeLabel(notification.type)}
                            </span>
                            {isUnread ? (
                              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
                                Nova
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                                <Check aria-hidden="true" className="size-3.5" />
                                Lida
                              </span>
                            )}
                          </div>
                          <h2 className="mt-2 text-lg font-bold text-slate-950">
                            {notification.title}
                          </h2>
                          <p className="mt-2 leading-7 text-slate-600">
                            {notification.message}
                          </p>
                          <time
                            dateTime={notification.createdAt}
                            className="mt-3 block text-sm text-slate-500"
                          >
                            {formatDateTime(notification.createdAt)}
                          </time>
                        </div>

                        {notification.href !== null || isUnread ? (
                          <button
                            type="button"
                            disabled={isMarking}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void openNotification(notification)}
                          >
                            {isMarking ? (
                              <Loader2
                                aria-hidden="true"
                                className="size-4 animate-spin"
                              />
                            ) : notification.href !== null ? (
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4"
                              />
                            ) : (
                              <Check aria-hidden="true" className="size-4" />
                            )}
                            {notification.href !== null
                              ? notificationActionLabel(notification.type)
                              : "Marcar como lida"}
                          </button>
                        ) : null}
                      </div>

                      {readErrorId === notification.id ? (
                        <p
                          role="alert"
                          className="mt-3 text-sm font-medium text-red-600"
                        >
                          Não foi possível marcar esta notificação como lida.
                          Tente novamente.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              <nav
                className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"
                aria-label="Paginação de notificações"
              >
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Anterior
                </button>
                <p className="text-sm font-medium text-slate-600">
                  Página {currentPage} de {totalPages}
                </p>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Próxima
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </nav>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function notificationTypeLabel(type: NotificationType): string {
  return type === "OPPORTUNITY_CREATED" ? "Oportunidade" : "Proposta";
}

function notificationActionLabel(type: NotificationType): string {
  return type === "OPPORTUNITY_CREATED"
    ? "Ver oportunidade"
    : "Ver proposta";
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

interface StateProps {
  loading?: boolean;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  onRetry?: () => void;
}

function PageState({
  loading = false,
  title,
  description,
  action,
}: StateProps) {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex min-h-[28rem] max-w-3xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="mx-auto size-8 animate-spin text-blue-600"
            />
          ) : (
            <ShieldAlert
              aria-hidden="true"
              className="mx-auto size-8 text-amber-600"
            />
          )}
          <h1 className="mt-4 text-2xl font-bold text-slate-950">{title}</h1>
          {description ? (
            <p className="mt-3 leading-7 text-slate-600">{description}</p>
          ) : null}
          {action ? (
            <Link
              href={action.href}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700"
            >
              {action.label}
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function InlineState({
  loading = false,
  title,
  description,
  onRetry,
}: StateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="mx-auto size-8 animate-spin text-blue-600"
        />
      ) : (
        <ShieldAlert
          aria-hidden="true"
          className="mx-auto size-8 text-red-600"
        />
      )}
      <h2 className="mt-4 text-xl font-bold text-slate-950">{title}</h2>
      {description ? (
        <p className="mt-2 leading-7 text-slate-600">{description}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          onClick={onRetry}
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}
