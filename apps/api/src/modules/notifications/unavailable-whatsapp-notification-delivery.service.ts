import { Injectable } from "@nestjs/common";

import {
  SendWhatsAppNotificationInput,
  WhatsAppNotificationDeliveryPort,
} from "./whatsapp-notification-delivery.port";

@Injectable()
export class UnavailableWhatsAppNotificationDeliveryService
  implements WhatsAppNotificationDeliveryPort
{
  async send(_input: SendWhatsAppNotificationInput): Promise<{ providerMessageId: string }> {
    throw new Error("WHATSAPP_DELIVERY_DISABLED");
  }
}
