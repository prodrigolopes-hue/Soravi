import { ConfigService } from "@nestjs/config";

import { createPasswordResetDeliveryPort } from "./auth.module";
import {
  PasswordResetDeliveryError,
} from "./password-reset-delivery.port";
import { ResendPasswordResetDeliveryAdapter } from "./resend-password-reset-delivery.adapter";
import { UnavailablePasswordResetDeliveryService } from "./unavailable-password-reset-delivery.service";

describe("UnavailablePasswordResetDeliveryService", () => {
  it("falha de forma tipada sem expor email ou token", async () => {
    const service = new UnavailablePasswordResetDeliveryService();
    const error = await service.sendReset({
      email: "maria@example.com",
      rawToken: "token-secreto",
      expiresAt: new Date(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordResetDeliveryError);
    expect(JSON.stringify(error)).not.toContain("maria@example.com");
    expect(JSON.stringify(error)).not.toContain("token-secreto");
  });
});

describe("createPasswordResetDeliveryPort", () => {
  it("mantém unavailable sem exigir configuração Resend", () => {
    const port = createPasswordResetDeliveryPort(
      new ConfigService({
        PASSWORD_RESET_DELIVERY_PROVIDER: "unavailable",
      }),
    );

    expect(port).toBeInstanceOf(UnavailablePasswordResetDeliveryService);
  });

  it("cria o adapter Resend somente quando selecionado", () => {
    const port = createPasswordResetDeliveryPort(
      new ConfigService({
        PASSWORD_RESET_DELIVERY_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        PASSWORD_RESET_EMAIL_FROM: "Soravi <nao-responda@example.com>",
        FRONTEND_PUBLIC_URL: "https://app.example.com",
      }),
    );

    expect(port).toBeInstanceOf(ResendPasswordResetDeliveryAdapter);
  });
});
