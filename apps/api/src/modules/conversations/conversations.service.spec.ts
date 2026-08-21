import "reflect-metadata";

import { ConversationStatus, ContractStatus, EstimatedDurationUnit, Role, ServiceRequestStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ConversationsService } from "./conversations.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

describe("ConversationsService", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      conversation: {
        findFirst: jest.fn(),
      },
    };

    service = new ConversationsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("CUSTOMER participante acessa", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      closedAt: null,
      contract: {
        id: "contract-id",
        status: ContractStatus.ACCEPTED,
        agreedAmountInCents: 150000,
        agreedDurationValue: 2,
        agreedDurationUnit: EstimatedDurationUnit.HOUR,
        acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
        customerProfile: { userId: "customer-user-id" },
        professionalProfile: { userId: "professional-user-id" },
        serviceRequest: {
          id: "request-id",
          title: "Instalar tomada",
          status: ServiceRequestStatus.OPEN,
        },
      },
    });

    const result = await service.findOne("customer-user-id", "conversation-id");

    expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: "conversation-id",
        contract: {
          OR: [
            { customerProfile: { userId: "customer-user-id" } },
            { professionalProfile: { userId: "customer-user-id" } },
          ],
        },
      },
      select: expect.objectContaining({
        id: true,
        status: true,
      }),
    });
    expect(result).toMatchObject({
      id: "conversation-id",
      participantRole: "CUSTOMER",
      contract: {
        id: "contract-id",
        status: ContractStatus.ACCEPTED,
      },
      serviceRequest: {
        id: "request-id",
        title: "Instalar tomada",
        status: ServiceRequestStatus.OPEN,
      },
    });
    expect(result).not.toHaveProperty("email");
  });

  it("PROFESSIONAL participante acessa", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      closedAt: null,
      contract: {
        id: "contract-id",
        status: ContractStatus.ACCEPTED,
        agreedAmountInCents: 150000,
        agreedDurationValue: 2,
        agreedDurationUnit: EstimatedDurationUnit.HOUR,
        acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
        customerProfile: { userId: "customer-user-id" },
        professionalProfile: { userId: "professional-user-id" },
        serviceRequest: {
          id: "request-id",
          title: "Instalar tomada",
          status: ServiceRequestStatus.OPEN,
        },
      },
    });

    const result = await service.findOne("professional-user-id", "conversation-id");

    expect(result.participantRole).toBe("PROFESSIONAL");
  });

  it("outro CUSTOMER recebe 404 neutro", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne("other-customer-user-id", "conversation-id"),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("outro PROFESSIONAL recebe 404 neutro", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne("other-professional-user-id", "conversation-id"),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("conversation inexistente retorna 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne("customer-user-id", "missing-conversation-id"),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("contrato correto é retornado", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      closedAt: null,
      contract: {
        id: "contract-id",
        status: ContractStatus.ACCEPTED,
        agreedAmountInCents: 210000,
        agreedDurationValue: 4,
        agreedDurationUnit: EstimatedDurationUnit.DAY,
        acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
        customerProfile: { userId: "customer-user-id" },
        professionalProfile: { userId: "professional-user-id" },
        serviceRequest: {
          id: "request-id",
          title: "Instalar tomadas",
          status: ServiceRequestStatus.IN_PROGRESS,
        },
      },
    });

    const result = await service.findOne("customer-user-id", "conversation-id");

    expect(result.contract).toMatchObject({
      id: "contract-id",
      status: ContractStatus.ACCEPTED,
      agreedAmountInCents: 210000,
      agreedDurationValue: 4,
      agreedDurationUnit: EstimatedDurationUnit.DAY,
      acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
    });
  });

  it("resposta não expõe dados privados", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      closedAt: null,
      contract: {
        id: "contract-id",
        status: ContractStatus.ACCEPTED,
        agreedAmountInCents: 150000,
        agreedDurationValue: 2,
        agreedDurationUnit: EstimatedDurationUnit.HOUR,
        acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
        customerProfile: { userId: "customer-user-id" },
        professionalProfile: { userId: "professional-user-id" },
        serviceRequest: {
          id: "request-id",
          title: "Instalar tomada",
          status: ServiceRequestStatus.OPEN,
        },
      },
    });

    const result = await service.findOne("customer-user-id", "conversation-id");

    expect(result).toMatchObject({
      id: "conversation-id",
      participantRole: "CUSTOMER",
    });
    expect(result).not.toHaveProperty("contract.customerProfile");
    expect(result).not.toHaveProperty("contract.professionalProfile");
    expect(result).not.toHaveProperty("serviceRequest.customerProfile");
    expect(result).not.toHaveProperty("messages");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("address");
  });
});
