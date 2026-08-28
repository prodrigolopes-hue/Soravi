import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ConfigService } from "@nestjs/config";

import { MetaWhatsAppPhoneVerificationDeliveryAdapter } from "./meta-whatsapp-phone-verification-delivery.adapter";

describe("MetaWhatsAppPhoneVerificationDeliveryAdapter", () => {
  const accessToken = "secret-meta-access-token";
  const input = {
    challengeId: "challenge-opaque-id",
    phoneNormalized: "+5521999999999",
    code: "012345",
    expiresAt: new Date("2026-08-27T20:00:00.000Z"),
  };
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let timeoutMock: jest.SpiedFunction<typeof AbortSignal.timeout>;
  let adapter: MetaWhatsAppPhoneVerificationDeliveryAdapter;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, "fetch");
    timeoutMock = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(new AbortController().signal);
    adapter = createAdapter();
  });

  it("envia o template de autenticação ao endpoint Meta correto", async () => {
    fetchMock.mockResolvedValue(successResponse());

    await adapter.sendOtp(input);

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v26.0/123456789/messages");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(timeoutMock).toHaveBeenCalledWith(7_000);
    expect(request?.signal).toBe(timeoutMock.mock.results[0].value);

    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "5521999999999",
      type: "template",
      template: {
        name: "soravi_phone_verification",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: "012345" }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: "012345" }],
          },
        ],
      },
    });
    expect(String(request?.body)).not.toContain(input.challengeId);
  });

  it.each([200, 201, 202, 299])("aceita resposta %s com message id", async (status) => {
    fetchMock.mockResolvedValue(successResponse(status));

    await expect(adapter.sendOtp(input)).resolves.toBeUndefined();
  });

  it.each([
    [400, "PERMANENT", "META_BAD_REQUEST"],
    [401, "PERMANENT", "META_AUTH_ERROR"],
    [403, "PERMANENT", "META_AUTH_ERROR"],
    [404, "PERMANENT", "META_CONFIGURATION_ERROR"],
    [429, "TRANSIENT", "META_RATE_LIMITED"],
    [500, "TRANSIENT", "META_SERVER_ERROR"],
  ] as const)("traduz HTTP %s para %s/%s", async (status, kind, code) => {
    fetchMock.mockResolvedValue(
      new Response("raw provider body with secrets", { status }),
    );

    await expect(adapter.sendOtp(input)).rejects.toMatchObject({
      kind,
      code,
      message: "Phone verification OTP delivery failed.",
    });
  });

  it("traduz timeout sem propagar o erro externo", async () => {
    const timeoutError = new Error("raw timeout with private data");
    timeoutError.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeoutError);

    await expect(adapter.sendOtp(input)).rejects.toMatchObject({
      kind: "TRANSIENT",
      code: "META_TIMEOUT",
      message: "Phone verification OTP delivery failed.",
    });
  });

  it("traduz falha de rede sem propagar o erro externo", async () => {
    fetchMock.mockRejectedValue(
      new Error("raw network error with token and recipient"),
    );

    await expect(adapter.sendOtp(input)).rejects.toMatchObject({
      kind: "TRANSIENT",
      code: "META_NETWORK_ERROR",
      message: "Phone verification OTP delivery failed.",
    });
  });

  it("não propaga body bruto da Meta", async () => {
    const rawBody = "raw-provider-secret-response";
    fetchMock.mockResolvedValue(new Response(rawBody, { status: 400 }));

    const error = await adapter.sendOtp(input).catch((caught) => caught);

    expect(JSON.stringify(error)).not.toContain(rawBody);
    expect(error).toMatchObject({
      kind: "PERMANENT",
      code: "META_BAD_REQUEST",
    });
  });

  it("rejeita 2xx sem aceitação compatível", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [] }));

    await expect(adapter.sendOtp(input)).rejects.toMatchObject({
      kind: "TRANSIENT",
      code: "META_INVALID_RESPONSE",
    });
  });

  it("não registra telefone, OTP, token ou bodies", async () => {
    const consoleSpies = [
      jest.spyOn(console, "log").mockImplementation(),
      jest.spyOn(console, "warn").mockImplementation(),
      jest.spyOn(console, "error").mockImplementation(),
    ];
    fetchMock.mockResolvedValue(new Response("raw provider body", { status: 400 }));

    await expect(adapter.sendOtp(input)).rejects.toBeDefined();

    for (const consoleSpy of consoleSpies) {
      expect(consoleSpy).not.toHaveBeenCalled();
    }
  });

  it("usa somente fetch nativo, sem SDK HTTP ou Meta", () => {
    const source = readFileSync(
      join(__dirname, "meta-whatsapp-phone-verification-delivery.adapter.ts"),
      "utf8",
    );

    expect(source).toContain("fetch(endpoint");
    expect(source).not.toMatch(/axios|HttpService|facebook-nodejs|whatsapp-sdk/u);
  });

  function createAdapter(): MetaWhatsAppPhoneVerificationDeliveryAdapter {
    const values: Record<string, string | number> = {
      META_WHATSAPP_ACCESS_TOKEN: accessToken,
      META_WHATSAPP_PHONE_NUMBER_ID: "123456789",
      META_WHATSAPP_GRAPH_API_VERSION: "v26.0",
      META_WHATSAPP_OTP_TEMPLATE_NAME: "soravi_phone_verification",
      META_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "pt_BR",
      META_WHATSAPP_HTTP_TIMEOUT_MS: 7_000,
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => values[key]),
      get: jest.fn((key: string, fallback: number) => values[key] ?? fallback),
    };

    return new MetaWhatsAppPhoneVerificationDeliveryAdapter(
      configService as unknown as ConfigService,
    );
  }

  function successResponse(status = 200): Response {
    return jsonResponse({ messages: [{ id: "wamid.accepted-message" }] }, status);
  }

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
});
