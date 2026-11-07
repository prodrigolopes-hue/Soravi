import { ConfigService } from "@nestjs/config";

import { NotificationType } from "../../generated/prisma/client";
import { MetaWhatsAppNotificationDeliveryAdapter } from "./meta-whatsapp-notification-delivery.adapter";

describe("MetaWhatsAppNotificationDeliveryAdapter", () => {
  const config = {
    META_WHATSAPP_NOTIFICATION_ACCESS_TOKEN: "token",
    META_WHATSAPP_NOTIFICATION_PHONE_NUMBER_ID: "phone-id",
    META_WHATSAPP_NOTIFICATION_GRAPH_API_VERSION: "v26.0",
    META_WHATSAPP_OPPORTUNITY_TEMPLATE_NAME: "opportunity",
    META_WHATSAPP_PROPOSAL_TEMPLATE_NAME: "proposal",
    META_WHATSAPP_NOTIFICATION_TEMPLATE_LANGUAGE: "pt_BR",
    META_WHATSAPP_HTTP_TIMEOUT_MS: 5_000,
    FRONTEND_PUBLIC_URL: "https://app.example.test",
  } as const;
  let fetchMock: jest.Mock;
  let adapter: MetaWhatsAppNotificationDeliveryAdapter;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ messages: [{ id: "accepted-id" }] }),
    });
    jest.spyOn(global, "fetch").mockImplementation(fetchMock);
    adapter = new MetaWhatsAppNotificationDeliveryAdapter({
      get: jest.fn((key: keyof typeof config, fallback?: unknown) => config[key] ?? fallback),
      getOrThrow: jest.fn((key: keyof typeof config) => config[key]),
    } as unknown as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    [NotificationType.OPPORTUNITY_CREATED, "opportunity"],
    [NotificationType.PROPOSAL_CREATED, "proposal"],
  ])("sends %s with the login path and preserved redirect query", async (eventType, templateName) => {
    await adapter.send({
      phoneNormalized: "+5511999999999",
      eventType,
      loginUrl: "https://app.example.test/login?redirect=%2Fopportunities%2Fresource-id",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.template.name).toBe(templateName);
    expect(body.template.components).toEqual([{
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "login?redirect=%2Fopportunities%2Fresource-id" }],
    }]);
  });

  it("rejects a non-HTTPS or cross-origin login URL before calling Meta", async () => {
    await expect(adapter.send({
      phoneNormalized: "+5511999999999",
      eventType: NotificationType.OPPORTUNITY_CREATED,
      loginUrl: "https://other.example.test/login?redirect=%2Fopportunities",
    })).rejects.toThrow("INVALID_NOTIFICATION_LOGIN_URL");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
