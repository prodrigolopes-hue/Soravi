import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import {
  PasswordResetDeliveryError,
  PasswordResetDeliveryPort,
  SendPasswordResetInput,
} from "./password-reset-delivery.port";

const PASSWORD_RESET_EMAIL_SUBJECT = "Redefina sua senha da Soravi";

export interface ResendEmailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendEmailResult {
  data: { id?: unknown } | null;
  error: unknown;
}

export interface ResendEmailClient {
  emails: {
    send(input: ResendEmailInput): Promise<ResendEmailResult>;
  };
}

@Injectable()
export class ResendPasswordResetDeliveryAdapter
  implements PasswordResetDeliveryPort
{
  private readonly from: string;
  private readonly frontendPublicUrl: string;
  private readonly client: ResendEmailClient;

  constructor(
    configService: ConfigService,
    client?: ResendEmailClient,
  ) {
    const apiKey = configService.getOrThrow<string>("RESEND_API_KEY");
    this.from = configService.getOrThrow<string>(
      "PASSWORD_RESET_EMAIL_FROM",
    );
    this.frontendPublicUrl = configService.getOrThrow<string>(
      "FRONTEND_PUBLIC_URL",
    );
    if (client) {
      this.client = client;
      return;
    }

    const resend = new Resend(apiKey);
    this.client = {
      emails: {
        send: async (input) => {
          const { data, error } = await resend.emails.send(input);

          return { data, error };
        },
      },
    };
  }

  async sendReset(input: SendPasswordResetInput): Promise<void> {
    const resetLink = this.buildResetLink(input.rawToken);

    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: input.email,
        subject: PASSWORD_RESET_EMAIL_SUBJECT,
        html: this.buildHtml(resetLink),
        text: this.buildText(resetLink),
      });

      if (
        result.error !== null ||
        typeof result.data?.id !== "string" ||
        result.data.id.length === 0
      ) {
        throw new PasswordResetDeliveryError("RESEND_DELIVERY_FAILED");
      }
    } catch {
      throw new PasswordResetDeliveryError("RESEND_DELIVERY_FAILED");
    }
  }

  private buildResetLink(rawToken: string): string {
    const resetUrl = new URL("/redefinir-senha", this.frontendPublicUrl);
    resetUrl.hash = new URLSearchParams({ token: rawToken }).toString();

    return resetUrl.toString();
  }

  private buildHtml(resetLink: string): string {
    const safeResetLink = this.escapeHtml(resetLink);

    return [
      "<!doctype html>",
      '<html lang="pt-BR">',
      "<body>",
      "<h1>Soravi</h1>",
      "<p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>",
      `<p><a href="${safeResetLink}">Redefinir minha senha</a></p>`,
      "<p>Este link é válido por 30 minutos.</p>",
      "<p>Se você não solicitou a redefinição, ignore este e-mail.</p>",
      "</body>",
      "</html>",
    ].join("");
  }

  private buildText(resetLink: string): string {
    return [
      "Soravi",
      "",
      "Recebemos uma solicitação para redefinir a senha da sua conta.",
      `Redefina sua senha: ${resetLink}`,
      "",
      "Este link é válido por 30 minutos.",
      "Se você não solicitou a redefinição, ignore este e-mail.",
    ].join("\n");
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
