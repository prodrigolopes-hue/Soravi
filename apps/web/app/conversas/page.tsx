import type { Metadata } from "next";

import { ConversationsListPage } from "../../components/conversations/conversations-list-page";

export const metadata: Metadata = {
  title: "Conversas | Soravi",
  description: "Acompanhe suas conversas na Soravi.",
};

export default function ConversationsRoute() {
  return <ConversationsListPage />;
}
