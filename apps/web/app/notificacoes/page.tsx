import type { Metadata } from "next";

import { NotificationsPage } from "../../components/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notificações | Soravi",
  description: "Acompanhe as novidades importantes da sua conta Soravi.",
};

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
