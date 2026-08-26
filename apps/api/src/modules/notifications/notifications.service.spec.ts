import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import { NotificationType } from "../../generated/prisma/client";
import { NotificationNotFoundException } from "./errors/notification-not-found.exception";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const notificationId = "625afb87-2b81-4de7-9606-8f382fff3341";

  let service: NotificationsService;
  let prismaMock: {
    notification: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    serviceOpportunity: { findMany: jest.Mock };
    proposal: { findMany: jest.Mock };
    message: { findMany: jest.Mock };
    conversation: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      notification: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([createNotification()]),
        findFirst: jest.fn().mockResolvedValue({ id: notificationId, readAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceOpportunity: {
        findMany: jest.fn().mockResolvedValue([
          { id: "725afb87-2b81-4de7-9606-8f382fff3341" },
        ]),
      },
      proposal: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      conversation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.notification.count(),
      await prismaMock.notification.findMany(),
    ]);
    service = new NotificationsService(prismaMock as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("conta somente notificações não lidas e não excluídas do usuário autenticado", async () => {
    prismaMock.notification.count.mockResolvedValue(4);

    const result = await service.countUnread(userId);

    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: {
        userId,
        readAt: null,
        deletedAt: null,
      },
    });
    expect(result).toEqual({ count: 4 });
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled();
  });

  it("retorna zero quando não há notificações não lidas", async () => {
    prismaMock.notification.count.mockResolvedValue(0);

    await expect(service.countUnread(userId)).resolves.toEqual({ count: 0 });
  });

  it("lista somente notificações do usuário autenticado", async () => {
    const result = await service.findAll(userId, 1, 20);

    const where = { userId, deletedAt: null };
    expect(prismaMock.notification.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(result.items).toHaveLength(1);
  });

  it("impede que notificações de terceiro apareçam na consulta", async () => {
    await service.findAll(userId, 1, 20);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    );
  });

  it("não lista notificações excluídas logicamente", async () => {
    await service.findAll(userId, 1, 20);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("aplica paginação customizada", async () => {
    const result = await service.findAll(userId, 2, 10);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("ordena por createdAt e id em ordem decrescente", async () => {
    await service.findAll(userId, 1, 20);

    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("não expõe userId na resposta", async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      { ...createNotification(), userId },
    ]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]).not.toHaveProperty("userId");
  });

  it("retorna href da oportunidade pertencente ao profissional", async () => {
    const result = await service.findAll(userId, 1, 20);

    expect(prismaMock.serviceOpportunity.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["725afb87-2b81-4de7-9606-8f382fff3341"] },
        professionalProfile: { userId },
      },
      select: { id: true },
    });
    expect(result.items[0]?.href).toBe(
      "/profissional/oportunidades/725afb87-2b81-4de7-9606-8f382fff3341",
    );
  });

  it("resolve a proposta para retornar o href da solicitação do cliente", async () => {
    const proposalId = "825afb87-2b81-4de7-9606-8f382fff3341";
    const serviceRequestId = "925afb87-2b81-4de7-9606-8f382fff3341";
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.PROPOSAL_CREATED,
        resourceType: "PROPOSAL",
        resourceId: proposalId,
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.proposal.findMany.mockResolvedValue([
      { id: proposalId, serviceRequestId },
    ]);

    const result = await service.findAll(userId, 1, 20);

    expect(prismaMock.proposal.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [proposalId] },
        serviceRequest: {
          deletedAt: null,
          customerProfile: { userId },
        },
      },
      select: { id: true, serviceRequestId: true },
    });
    expect(result.items[0]?.href).toBe(`/solicitacoes/${serviceRequestId}`);
  });

  it("retorna href null quando o recurso relacionado não existe", async () => {
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]?.href).toBeNull();
  });

  it("resolve MESSAGE_CREATED para o href da conversa com ownership", async () => {
    const messageId = "a25afb87-2b81-4de7-9606-8f382fff3341";
    const conversationId = "b25afb87-2b81-4de7-9606-8f382fff3341";
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "MESSAGE",
        resourceId: messageId,
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([
      { id: messageId, conversationId },
    ]);

    const result = await service.findAll(userId, 1, 20);

    expect(prismaMock.message.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [messageId] },
        conversation: {
          contract: {
            OR: [
              { customerProfile: { userId } },
              { professionalProfile: { userId } },
            ],
          },
        },
      },
      select: { id: true, conversationId: true },
    });
    expect(result.items[0]?.href).toBe(`/conversas/${conversationId}`);
  });

  it("resolve MESSAGE_CREATED + CONVERSATION com ownership", async () => {
    const conversationId = "e25afb87-2b81-4de7-9606-8f382fff3341";
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "CONVERSATION",
        resourceId: conversationId,
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([{ id: conversationId }]);

    const result = await service.findAll(userId, 1, 20);

    expect(prismaMock.conversation.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [conversationId] },
        contract: {
          OR: [
            { customerProfile: { userId } },
            { professionalProfile: { userId } },
          ],
        },
      },
      select: { id: true },
    });
    expect(result.items[0]?.href).toBe(`/conversas/${conversationId}`);
  });

  it("retorna href null quando a Conversation não existe ou não pertence ao usuário", async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "CONVERSATION",
        resourceId: "f25afb87-2b81-4de7-9606-8f382fff3341",
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]?.href).toBeNull();
  });

  it("não expõe dados privados ao resolver MESSAGE_CREATED + CONVERSATION", async () => {
    const conversationId = "125afb87-2b81-4de7-9606-8f382fff3342";
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "CONVERSATION",
        resourceId: conversationId,
        userId,
        customerProfileId: "customer-profile-id",
        professionalProfileId: "professional-profile-id",
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([{ id: conversationId }]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]).not.toHaveProperty("userId");
    expect(result.items[0]).not.toHaveProperty("customerProfileId");
    expect(result.items[0]).not.toHaveProperty("professionalProfileId");
  });

  it("retorna href null quando a Message não existe ou não pertence ao usuário", async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "MESSAGE",
        resourceId: "c25afb87-2b81-4de7-9606-8f382fff3341",
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]?.href).toBeNull();
  });

  it("não expõe dados privados da Message ao resolver href", async () => {
    const messageId = "d25afb87-2b81-4de7-9606-8f382fff3341";
    prismaMock.notification.findMany.mockResolvedValue([
      createNotification({
        type: NotificationType.MESSAGE_CREATED,
        resourceType: "MESSAGE",
        resourceId: messageId,
        content: "conteúdo privado",
        senderUserId: "sender-user-id",
        professionalProfileId: "professional-profile-id",
        customerProfileId: "customer-profile-id",
      }),
    ]);
    prismaMock.serviceOpportunity.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([
      { id: messageId, conversationId: "conversation-id" },
    ]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]).not.toHaveProperty("content");
    expect(result.items[0]).not.toHaveProperty("senderUserId");
    expect(result.items[0]).not.toHaveProperty("professionalProfileId");
    expect(result.items[0]).not.toHaveProperty("customerProfileId");
  });

  it("não expõe dados privados extras ao adicionar href", async () => {
    prismaMock.notification.findMany.mockResolvedValue([
      {
        ...createNotification(),
        userId,
        professionalProfileId: "professional-profile-id",
        customerProfileId: "customer-profile-id",
      },
    ]);

    const result = await service.findAll(userId, 1, 20);

    expect(result.items[0]).not.toHaveProperty("userId");
    expect(result.items[0]).not.toHaveProperty("professionalProfileId");
    expect(result.items[0]).not.toHaveProperty("customerProfileId");
  });

  it("permite que o owner marque a notificação como lida", async () => {
    const before = Date.now();

    await service.markAsRead(userId, notificationId);

    const after = Date.now();
    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
      where: { id: notificationId, userId, deletedAt: null },
      select: { id: true, readAt: true },
    });
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        userId,
        deletedAt: null,
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    const readAt = prismaMock.notification.updateMany.mock.calls[0][0].data
      .readAt as Date;
    expect(readAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(readAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("mantém a leitura idempotente quando a notificação já foi lida", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: notificationId,
      readAt: new Date("2026-08-24T12:00:00.000Z"),
    });

    await service.markAsRead(userId, notificationId);

    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled();
  });

  it("retorna 404 neutro para notificação de outro usuário", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead(userId, notificationId),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
  });

  it("retorna 404 para notificação inexistente", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead(userId, "725afb87-2b81-4de7-9606-8f382fff3341"),
    ).rejects.toBeInstanceOf(NotificationNotFoundException);
  });
});

function createNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "625afb87-2b81-4de7-9606-8f382fff3341",
    type: NotificationType.OPPORTUNITY_CREATED,
    title: "Nova oportunidade",
    message: "Uma nova oportunidade está disponível.",
    resourceType: "SERVICE_OPPORTUNITY",
    resourceId: "725afb87-2b81-4de7-9606-8f382fff3341",
    readAt: null,
    createdAt: new Date("2026-08-24T10:00:00.000Z"),
    ...overrides,
  };
}
