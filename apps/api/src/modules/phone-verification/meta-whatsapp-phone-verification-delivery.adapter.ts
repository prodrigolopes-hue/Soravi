import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  PhoneVerificationDeliveryError,
  PhoneVerificationDeliveryPort,
  SendPhoneVerificationOtpInput,
} from "./phone-verification-delivery.port";

const META_GRAPH_API_BASE_URL = "https://graph.facebook.com";

interface MetaMessageAcceptanceResponse {
  messages?: Array<{ id?: unknown }>;
}

@Injectable()
export class MetaWhatsAppPhoneVerificationDeliveryAdapter
  implements PhoneVerificationDeliveryPort
{
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly graphApiVersion: string;
  private readonly templateName: string;
  private readonly templateLanguage: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    this.accessToken = configService.getOrThrow<string>(
      "META_WHATSAPP_ACCESS_TOKEN",
    );
    this.phoneNumberId = configService.getOrThrow<string>(
      "META_WHATSAPP_PHONE_NUMBER_ID",
    );
    this.graphApiVersion = configService.getOrThrow<string>(
      "META_WHATSAPP_GRAPH_API_VERSION",
    );
    this.templateName = configService.getOrThrow<string>(
      "META_WHATSAPP_OTP_TEMPLATE_NAME",
    );
    this.templateLanguage = configService.getOrThrow<string>(
      "META_WHATSAPP_OTP_TEMPLATE_LANGUAGE",
    );
    this.timeoutMs = configService.get<number>(
      "META_WHATSAPP_HTTP_TIMEOUT_MS",
      5_000,
    );
  }

  async sendOtp(input: SendPhoneVerificationOtpInput): Promise<void> {
    const endpoint = [
      META_GRAPH_API_BASE_URL,
      encodeURIComponent(this.graphApiVersion),
      encodeURIComponent(this.phoneNumberId),
      "messages",
    ].join("/");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: this.toMetaDestination(input.phoneNormalized),
          type: "template",
          template: {
            name: this.templateName,
            language: { code: this.templateLanguage },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: input.code }],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: input.code }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw this.fromHttpStatus(response.status);
      }

      const payload = (await response.json()) as MetaMessageAcceptanceResponse;
      const providerMessageId = payload.messages?.[0]?.id;

      if (
        typeof providerMessageId !== "string" ||
        providerMessageId.length === 0
      ) {
        throw new PhoneVerificationDeliveryError(
          "TRANSIENT",
          "META_INVALID_RESPONSE",
        );
      }
    } catch (error: unknown) {
      if (error instanceof PhoneVerificationDeliveryError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new PhoneVerificationDeliveryError(
          "TRANSIENT",
          "META_TIMEOUT",
        );
      }

      throw new PhoneVerificationDeliveryError(
        "TRANSIENT",
        "META_NETWORK_ERROR",
      );
    }
  }

  private toMetaDestination(phoneNormalized: string): string {
    return phoneNormalized.startsWith("+")
      ? phoneNormalized.slice(1)
      : phoneNormalized;
  }

  private fromHttpStatus(status: number): PhoneVerificationDeliveryError {
    if (status === 429) {
      return new PhoneVerificationDeliveryError(
        "TRANSIENT",
        "META_RATE_LIMITED",
      );
    }

    if (status >= 500) {
      return new PhoneVerificationDeliveryError(
        "TRANSIENT",
        "META_SERVER_ERROR",
      );
    }

    if (status === 401 || status === 403) {
      return new PhoneVerificationDeliveryError(
        "PERMANENT",
        "META_AUTH_ERROR",
      );
    }

    if (status === 404) {
      return new PhoneVerificationDeliveryError(
        "PERMANENT",
        "META_CONFIGURATION_ERROR",
      );
    }

    return new PhoneVerificationDeliveryError(
      "PERMANENT",
      "META_BAD_REQUEST",
    );
  }
}
