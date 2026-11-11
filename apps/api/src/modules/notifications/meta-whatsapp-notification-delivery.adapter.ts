import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { NotificationType } from "../../generated/prisma/client";
import {
  SendWhatsAppNotificationInput,
  WhatsAppNotificationDeliveryPort,
} from "./whatsapp-notification-delivery.port";

@Injectable()
export class MetaWhatsAppNotificationDeliveryAdapter
  implements WhatsAppNotificationDeliveryPort
{
  constructor(private readonly config: ConfigService) {}

  async send(input: SendWhatsAppNotificationInput): Promise<{ providerMessageId: string }> {
    const templateName = this.config.getOrThrow<string>(
      input.eventType === NotificationType.OPPORTUNITY_CREATED
        ? "META_WHATSAPP_OPPORTUNITY_TEMPLATE_NAME"
        : "META_WHATSAPP_PROPOSAL_TEMPLATE_NAME",
    );
    const endpoint = [
      "https://graph.facebook.com",
      encodeURIComponent(this.config.getOrThrow<string>("META_WHATSAPP_NOTIFICATION_GRAPH_API_VERSION")),
      encodeURIComponent(this.config.getOrThrow<string>("META_WHATSAPP_NOTIFICATION_PHONE_NUMBER_ID")),
      "messages",
    ].join("/");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.getOrThrow<string>("META_WHATSAPP_NOTIFICATION_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.phoneNormalized.replace(/^\+/u, ""),
        type: "template",
        template: {
          name: templateName,
          language: {
            code: this.config.get<string>("META_WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE", "pt_BR"),
          },
          components: [{
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: this.toTemplateUrlParameter(input.loginUrl) }],
          }],
        },
      }),
      signal: AbortSignal.timeout(this.config.get<number>("META_WHATSAPP_HTTP_TIMEOUT_MS", 5_000)),
    });
    if (!response.ok) throw new Error(`META_HTTP_${response.status}`);
    const payload = (await response.json()) as { messages?: Array<{ id?: unknown }> };
    const providerMessageId = payload.messages?.[0]?.id;
    if (typeof providerMessageId !== "string" || providerMessageId.length === 0) {
      throw new Error("META_INVALID_RESPONSE");
    }
    return { providerMessageId };
  }

  private toTemplateUrlParameter(loginUrl: string): string {
    const publicOrigin = new URL(
      this.config.getOrThrow<string>("FRONTEND_PUBLIC_URL"),
    );
    const url = new URL(loginUrl);

    if (
      publicOrigin.protocol !== "https:" ||
      url.protocol !== "https:" ||
      url.origin !== publicOrigin.origin
    ) {
      throw new Error("INVALID_NOTIFICATION_LOGIN_URL");
    }

    return `${url.pathname.replace(/^\/+/, "")}${url.search}`;
  }
}
