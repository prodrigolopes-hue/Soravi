import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import {
  EmailVerificationDeliveryError,
  EmailVerificationDeliveryPort,
  SendEmailVerificationInput,
} from "./email-verification-delivery.port";

const SUBJECT = "Confirme seu e-mail na Soravi";

@Injectable()
export class ResendEmailVerificationDeliveryAdapter
  implements EmailVerificationDeliveryPort
{
  private readonly from: string;
  private readonly frontendPublicUrl: string;
  private readonly resend: Resend;

  constructor(configService: ConfigService) {
    this.from = configService.getOrThrow<string>("PASSWORD_RESET_EMAIL_FROM");
    this.frontendPublicUrl = configService.getOrThrow<string>("FRONTEND_PUBLIC_URL");
    this.resend = new Resend(configService.getOrThrow<string>("RESEND_API_KEY"));
  }

  async sendVerification(input: SendEmailVerificationInput): Promise<void> {
    const verificationUrl = new URL("/verificar-email", this.frontendPublicUrl);
    verificationUrl.hash = new URLSearchParams({ token: input.rawToken }).toString();
    const link = verificationUrl.toString();

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: input.email,
        subject: SUBJECT,
        html: `<p>Confirme seu e-mail para concluir o cadastro na Soravi.</p><p><a href="${escapeHtml(link)}">Confirmar e-mail</a></p><p>Este link vale por 24 horas.</p>`,
        text: `Confirme seu e-mail na Soravi: ${link}\n\nEste link vale por 24 horas.`,
      });
      if (error !== null || typeof data?.id !== "string" || data.id.length === 0) {
        throw new EmailVerificationDeliveryError("RESEND_DELIVERY_FAILED");
      }
    } catch {
      throw new EmailVerificationDeliveryError("RESEND_DELIVERY_FAILED");
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
