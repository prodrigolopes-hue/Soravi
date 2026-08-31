import { ConfigService } from "@nestjs/config";

import { PasswordResetDeliveryError } from "./password-reset-delivery.port";
import {
  ResendEmailClient,
  ResendEmailInput,
  ResendEmailResult,
  ResendPasswordResetDeliveryAdapter,
} from "./resend-password-reset-delivery.adapter";

class ResendEmailClientMock implements ResendEmailClient {
  readonly inputs: ResendEmailInput[] = [];
  result: ResendEmailResult = {
    data: { id: "email-id" },
    error: null,
  };

  readonly emails = {
    send: async (input: ResendEmailInput): Promise<ResendEmailResult> => {
      this.inputs.push(input);
      return this.result;
    },
  };
}

describe("ResendPasswordResetDeliveryAdapter", () => {
  const apiKey = "re_api-key-secreta";
  const rawToken = "token-secreto_123";
  const email = "maria@example.com";
  const from = "Soravi <nao-responda@example.com>";

  function createAdapter(client: ResendEmailClientMock) {
    return new ResendPasswordResetDeliveryAdapter(
      new ConfigService({
        RESEND_API_KEY: apiKey,
        PASSWORD_RESET_EMAIL_FROM: from,
        FRONTEND_PUBLIC_URL: "https://app.example.com/base",
      }),
      client,
    );
  }

  it("envia destinatário, remetente, assunto, HTML e texto corretos", async () => {
    const client = new ResendEmailClientMock();
    const adapter = createAdapter(client);

    await expect(
      adapter.sendReset({
        email,
        rawToken,
        expiresAt: new Date("2026-08-31T12:30:00.000Z"),
      }),
    ).resolves.toBeUndefined();

    expect(client.inputs).toHaveLength(1);
    const input = client.inputs[0];

    expect(input).toBeDefined();
    if (!input) {
      throw new Error("O envio ao Resend não foi registrado.");
    }

    expect(input.to).toBe(email);
    expect(input.from).toBe(from);
    expect(input.subject).toBe("Redefina sua senha da Soravi");
    expect(input.html).toContain("<html");
    expect(input.text).toContain("Soravi");
    expect(input.html).toContain("#token=token-secreto_123");
    expect(input.text).toContain("#token=token-secreto_123");
    expect(input.html).not.toContain(email);
    expect(input.text).not.toContain(email);
    expect(input.html).not.toContain("userId");
    expect(input.text).not.toContain("userId");
    expect(input.html).toContain("30 minutos");
    expect(input.text).toContain("30 minutos");
  });

  it("converte resposta de erro do provider em falha sanitizada", async () => {
    const client = new ResendEmailClientMock();
    client.result = {
      data: null,
      error: {
        message: `${apiKey} ${rawToken} ${email}`,
      },
    };
    const adapter = createAdapter(client);

    const error = await adapter
      .sendReset({
        email,
        rawToken,
        expiresAt: new Date(),
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordResetDeliveryError);
    expect(error).toMatchObject({ code: "RESEND_DELIVERY_FAILED" });
    expect(JSON.stringify(error)).not.toContain(rawToken);
    expect(JSON.stringify(error)).not.toContain(apiKey);
    expect(JSON.stringify(error)).not.toContain(email);
  });

  it("rejeita resposta sem confirmação de envio", async () => {
    const client = new ResendEmailClientMock();
    client.result = { data: {}, error: null };

    await expect(
      createAdapter(client).sendReset({
        email,
        rawToken,
        expiresAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(PasswordResetDeliveryError);
  });
});
