import {
  CommunicationChannel,
  CommunicationPreference,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CommunicationPreferencesService } from "./communication-preferences.service";

describe("CommunicationPreferencesService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  let service: CommunicationPreferencesService;
  let prismaMock: {
    communicationPreference: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
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

  it("cria preferência WHATSAPP com opt-in e limpa optedOutAt", async () => {
    const before = Date.now();

    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      enabled: true,
      consentVersion: "1.0",
      consentPurpose: "Alertas operacionais",
      consentSource: "ACCOUNT_SETTINGS",
    });

    const after = Date.now();
    expect(prismaMock.communicationPreference.upsert).toHaveBeenCalledWith({
      where: {
        userId_channel: { userId, channel: CommunicationChannel.WHATSAPP },
      },
      create: {
        userId,
        channel: CommunicationChannel.WHATSAPP,
        enabled: true,
        optedInAt: expect.any(Date),
        optedOutAt: null,
        consentVersion: "1.0",
        consentPurpose: "Alertas operacionais",
        consentSource: "ACCOUNT_SETTINGS",
      },
      update: expect.objectContaining({
        enabled: true,
        optedInAt: expect.any(Date),
        optedOutAt: null,
      }),
    });
    const optedInAt = prismaMock.communicationPreference.upsert.mock.calls[0][0]
      .create.optedInAt as Date;
    expect(optedInAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(optedInAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("define optedOutAt ao desabilitar preferência ativa", async () => {
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: true, optedOutAt: null }),
    );

    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      enabled: false,
    });

    expect(prismaMock.communicationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          enabled: false,
          optedOutAt: expect.any(Date),
        },
      }),
    );
  });

  it("não reinicia optedInAt quando a preferência continua habilitada", async () => {
    const originalOptedInAt = new Date("2026-08-25T10:00:00.000Z");
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: true, optedInAt: originalOptedInAt }),
    );

    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      enabled: true,
    });

    expect(prismaMock.communicationPreference.upsert.mock.calls[0][0].update)
      .toEqual({ enabled: true });
  });

  it("não inventa optedOutAt quando a preferência continua desabilitada", async () => {
    prismaMock.communicationPreference.findUnique.mockResolvedValue(
      createPreference({ enabled: false, optedInAt: null, optedOutAt: null }),
    );

    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      enabled: false,
    });

    expect(prismaMock.communicationPreference.upsert.mock.calls[0][0].update)
      .toEqual({ enabled: false });
  });

  it("usa a chave única userId e channel para leitura e escrita", async () => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
      enabled: false,
    });

    const uniqueWhere = {
      userId_channel: { userId, channel: CommunicationChannel.WHATSAPP },
    };
    expect(prismaMock.communicationPreference.findUnique).toHaveBeenCalledWith({
      where: uniqueWhere,
    });
    expect(prismaMock.communicationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: uniqueWhere }),
    );
  });

  it("não armazena dados sensíveis fora dos metadados de consentimento", async () => {
    await service.upsertPreference({
      userId,
      channel: CommunicationChannel.WHATSAPP,
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
