import { NotificationType } from "../../generated/prisma/client";

export interface SendWhatsAppNotificationInput {
  phoneNormalized: string;
  eventType: typeof NotificationType.OPPORTUNITY_CREATED | typeof NotificationType.PROPOSAL_CREATED;
  loginUrl: string;
}

export interface WhatsAppNotificationDeliveryPort {
  send(input: SendWhatsAppNotificationInput): Promise<{ providerMessageId: string }>;
}

export const WHATSAPP_NOTIFICATION_DELIVERY_PORT = Symbol(
  "WHATSAPP_NOTIFICATION_DELIVERY_PORT",
);
