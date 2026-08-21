import type { Metadata } from "next";

import { ConversationPage } from "../../../components/conversations/conversation-page";

export const metadata: Metadata = {
  title: "Conversa | Soravi",
  description: "Acompanhe a conversa de uma contratação na Soravi.",
};

interface ConversationRouteProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export default async function ConversationRoute({
  params,
}: ConversationRouteProps) {
  const { conversationId } = await params;

  return <ConversationPage conversationId={conversationId} />;
}