"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  notificationsListUrl,
  notificationsUpdatedEventName,
  parseNotificationsListResponse,
} from "../../lib/api";
import { useAuth } from "../auth/auth-provider";

const PAGE_SIZE = 20;

interface NotificationBellProps {
  mobile?: boolean;
  onAction?: () => void;
}

export function NotificationBell({
  mobile = false,
  onAction,
}: NotificationBellProps) {
  const { accessToken } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const loadUnreadIndicator = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setHasUnread(false);
      return;
    }

    try {
      const response = await fetch(notificationsListUrl(1, PAGE_SIZE), {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        return;
      }

      const parsed = parseNotificationsListResponse(payload);

      if (parsed) {
        setHasUnread(parsed.items.some((item) => item.readAt === null));
      }
    } catch {
      // O sino permanece funcional mesmo quando o indicador não pode ser carregado.
    }
  }, [accessToken]);

  useEffect(() => {
    void loadUnreadIndicator();

    function handleNotificationsUpdated(): void {
      void loadUnreadIndicator();
    }

    window.addEventListener(
      notificationsUpdatedEventName,
      handleNotificationsUpdated,
    );

    return () => {
      window.removeEventListener(
        notificationsUpdatedEventName,
        handleNotificationsUpdated,
      );
    };
  }, [loadUnreadIndicator]);

  const ariaLabel = hasUnread
    ? "Notificações — há notificações não lidas"
    : "Notificações";

  if (mobile) {
    return (
      <Link
        href="/notificacoes"
        aria-label={ariaLabel}
        className="flex items-center gap-3 rounded-xl px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        onClick={onAction}
      >
        <span className="relative">
          <Bell aria-hidden="true" className="size-5" />
          {hasUnread ? <UnreadDot /> : null}
        </span>
        Notificações
      </Link>
    );
  }

  return (
    <Link
      href="/notificacoes"
      aria-label={ariaLabel}
      className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <Bell aria-hidden="true" className="size-5" />
      {hasUnread ? <UnreadDot /> : null}
    </Link>
  );
}

function UnreadDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-white bg-blue-600"
    />
  );
}
