import { PrismaService } from "../../database/prisma.service";
import {
  CommunicationChannel,
  CommunicationPreference,
  NotificationType,
} from "../../generated/prisma/client";
import { CommunicationPreferencesService } from "./communication-preferences.service";

describe("CommunicationPreferencesService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  let service: CommunicationPreferencesService;
  let prismaMock: {
    communicationPreference: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(() => {
    prismaMock = {
      communicationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(createPreference()),
      },
    };
    service = new CommunicationPreferencesService(
      prismaMock as unknown as PrismaService,
    );
  });

  it.each([
    NotificationType.OPPORTUNITY_CREATED,
    NotificationType.PROPOSAL_CREATED,
  ])("cria preferencia separada para o evento %s", async (eventType) => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType,
      enabled: true,
    });

    expect(prismaMock.communicationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_channel_eventType: {
            userId,
            channel: CommunicationChannel.WHATSAPP,
            eventType,
          },
        },
        create: expect.objectContaining({ userId, eventType, enabled: true }),
      }),
    );
  });

  it("usa userId, channel e eventType na leitura", async () => {
    await service.getPreference(
      userId,
      CommunicationChannel.WHATSAPP,
      NotificationType.MESSAGE_CREATED,
    );

    expect(prismaMock.communicationPreference.findUnique).toHaveBeenCalledWith({
      where: {
        userId_channel_eventType: {
          userId,
          channel: CommunicationChannel.WHATSAPP,
          eventType: NotificationType.MESSAGE_CREATED,
        },
      },
    });
  });

  it("permite preferencias diferentes para o mesmo usuario e canal", async () => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      enabled: true,
    });
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
      enabled: false,
    });

    const keys = prismaMock.communicationPreference.upsert.mock.calls.map(
      ([call]) => call.where.userId_channel_eventType,
    );
    expect(keys).toEqual([
      {
        userId,
        channel: CommunicationChannel.WHATSAPP,
        eventType: NotificationType.OPPORTUNITY_CREATED,
      },
      {
        userId,
        channel: CommunicationChannel.WHATSAPP,
        eventType: NotificationType.PROPOSAL_CREATED,
      },
    ]);
  });

  it("faz opt-in, limpa optedOutAt e inclui metadados fornecidos", async () => {
    const before = Date.now();
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      enabled: true,
      consentVersion: "1.0",
      consentPurpose: "Alertas operacionais",
      consentSource: "ACCOUNT_SETTINGS",
    });
    const call = prismaMock.communicationPreference.upsert.mock.calls[0][0];

    expect(call.create).toEqual({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      enabled: true,
      optedInAt: expect.any(Date),
      optedOutAt: null,
      consentVersion: "1.0",
      consentPurpose: "Alertas operacionais",
      consentSource: "ACCOUNT_SETTINGS",
    });
    expect(call.create.optedInAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(call.update).toEqual({
      enabled: true,
      optedInAt: expect.any(Date),
      optedOutAt: null,
      consentVersion: "1.0",
      consentPurpose: "Alertas operacionais",
      consentSource: "ACCOUNT_SETTINGS",
    });
  });

  it("faz opt-out somente na transicao de true para false", async () => {
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: true, optedOutAt: null }),
    );
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      enabled: false,
    });

    expect(prismaMock.communicationPreference.upsert.mock.calls[0][0].update)
      .toEqual({ enabled: false, optedOutAt: expect.any(Date) });
  });

  it("preserva optedInAt quando continua habilitada", async () => {
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: true }),
    );
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      enabled: true,
    });

    expect(prismaMock.communicationPreference.upsert.mock.calls[0][0].update)
      .toEqual({ enabled: true });
  });

  it("nao cria outro optedOutAt quando continua desabilitada", async () => {
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: false, optedInAt: null, optedOutAt: null }),
    );
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
      enabled: false,
    });

    expect(prismaMock.communicationPreference.upsert.mock.calls[0][0].update)
      .toEqual({ enabled: false });
  });

  it("nao usa nem cria consentimento global implicito", async () => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
      enabled: false,
    });

    const call = prismaMock.communicationPreference.upsert.mock.calls[0][0];
    expect(call.where).toHaveProperty("userId_channel_eventType");
    expect(call.where).not.toHaveProperty("userId_channel");
    expect(call.create).toHaveProperty(
      "eventType",
      NotificationType.PROPOSAL_CREATED,
    );
  });

  it("nao armazena dados sensiveis", async () => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.MESSAGE_CREATED,
      enabled: true,
    });

    const call = prismaMock.communicationPreference.upsert.mock.calls[0][0];
    for (const data of [call.create, call.update]) {
      expect(data).not.toHaveProperty("phone");
      expect(data).not.toHaveProperty("email");
      expect(data).not.toHaveProperty("payload");
      expect(data).not.toHaveProperty("message");
    }
  });
});

function createPreference(
  overrides: Partial<CommunicationPreference> = {},
): CommunicationPreference {
  return {
    id: "625afb87-2b81-4de7-9606-8f382fff3341",
    userId: "525afb87-2b81-4de7-9606-8f382fff3341",
    channel: CommunicationChannel.WHATSAPP,
    eventType: NotificationType.OPPORTUNITY_CREATED,
    enabled: true,
    consentVersion: "1.0",
    consentPurpose: "Alertas operacionais",
    optedInAt: new Date("2026-08-25T10:00:00.000Z"),
    optedOutAt: null,
    consentSource: "ACCOUNT_SETTINGS",
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    updatedAt: new Date("2026-08-25T10:00:00.000Z"),
    ...overrides,
  };
}
