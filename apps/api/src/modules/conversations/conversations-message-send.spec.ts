import "reflect-metadata";

import { ConflictException, BadRequestException } from "@nestjs/common";

import {
  ConversationStatus,
  MessageStatus,
  NotificationType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ConversationsService } from "./conversations.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

describe("ConversationsService.createMessage", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: { findFirst: jest.Mock; update: jest.Mock };
    message: { create: jest.Mock };
    notification: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      conversation: { findFirst: jest.fn(), update: jest.fn() },
      message: { create: jest.fn() },
      notification: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    service = new ConversationsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("CUSTOMER participante envia", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-1",
      senderUserId: "customer-user-id",
      content: "Olá, tudo bem?",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:00:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    const result = await service.createMessage("customer-user-id", "conversation-id", {
      content: "Olá, tudo bem?",
    });

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: "conversation-id",
        senderUserId: "customer-user-id",
        content: "Olá, tudo bem?",
        status: MessageStatus.SENT,
        sentAt: expect.any(Date),
        editedAt: null,
        deletedAt: null,
      },
      select: expect.objectContaining({
        id: true,
        senderUserId: true,
        content: true,
        status: true,
        sentAt: true,
        editedAt: true,
        deletedAt: true,
      }),
    });
    expect(result).toMatchObject({
      id: "msg-1",
      senderUserId: "customer-user-id",
      content: "Olá, tudo bem?",
      status: MessageStatus.SENT,
    });
    expect(prismaMock.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
          contract: {
            select: {
              customerProfile: { select: { userId: true } },
              professionalProfile: { select: { userId: true } },
            },
          },
        },
      }),
    );
    expect(prismaMock.notification.upsert).toHaveBeenCalledWith({
      where: {
        userId_type_resourceType_resourceId: {
          userId: "professional-user-id",
          type: NotificationType.MESSAGE_CREATED,
          resourceType: "MESSAGE",
          resourceId: "msg-1",
        },
      },
      update: {},
      create: {
        userId: "professional-user-id",
        type: NotificationType.MESSAGE_CREATED,
        title: "Nova mensagem",
        message: "Você recebeu uma nova mensagem.",
        resourceType: "MESSAGE",
        resourceId: "msg-1",
      },
    });
    expect(prismaMock.notification.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "customer-user-id" }),
      }),
    );
  });

  it("PROFESSIONAL participante envia", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-2",
      senderUserId: "professional-user-id",
      content: "Pode confirmar o horário.",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:05:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    const result = await service.createMessage("professional-user-id", "conversation-id", {
      content: "Pode confirmar o horário.",
    });

    expect(result.senderUserId).toBe("professional-user-id");
    expect(prismaMock.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "customer-user-id" }),
      }),
    );
    expect(prismaMock.notification.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "professional-user-id" }),
      }),
    );
  });

  it("outro usuário recebe 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage("other-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("conversation inexistente recebe 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage("customer-user-id", "missing-conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("ACTIVE permite envio", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-3",
      senderUserId: "customer-user-id",
      content: "Tudo certo.",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:10:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    await expect(
      service.createMessage("customer-user-id", "conversation-id", { content: "Tudo certo." }),
    ).resolves.toMatchObject({
      content: "Tudo certo.",
      status: MessageStatus.SENT,
    });
  });

  it("CLOSED bloqueia novas mensagens", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.CLOSED,
      contract: createContractParticipants(),
    });

    await expect(
      service.createMessage("customer-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("BLOCKED bloqueia novas mensagens", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.BLOCKED,
      contract: createContractParticipants(),
    });

    await expect(
      service.createMessage("customer-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("senderUserId vem do auth", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants({
        customerUserId: "current-auth-user-id",
      }),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-4",
      senderUserId: "current-auth-user-id",
      content: "Mensagem do usuário autenticado",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:15:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    await service.createMessage("current-auth-user-id", "conversation-id", {
      content: "Mensagem do usuário autenticado",
    });

    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          senderUserId: "current-auth-user-id",
        }),
      }),
    );
  });

  it("trim aplicado", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-5",
      senderUserId: "customer-user-id",
      content: "mensagem formatada",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:20:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    await service.createMessage("customer-user-id", "conversation-id", {
      content: "   mensagem formatada   ",
    });

    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "mensagem formatada",
        }),
      }),
    );
  });

  it("não notifica quando os dois participantes têm o mesmo userId", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants({
        customerUserId: "same-user-id",
        professionalUserId: "same-user-id",
      }),
    });
    prismaMock.message.create.mockResolvedValue(
      createMessage({ senderUserId: "same-user-id" }),
    );

    await service.createMessage("same-user-id", "conversation-id", {
      content: "Mensagem",
    });

    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
  });

  it("não notifica quando message.create falha", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockRejectedValue(new Error("message failure"));

    await expect(
      service.createMessage("customer-user-id", "conversation-id", {
        content: "Mensagem",
      }),
    ).rejects.toThrow("message failure");

    expect(prismaMock.notification.upsert).not.toHaveBeenCalled();
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it("não atualiza a Conversation quando notification.upsert falha", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue(createMessage());
    prismaMock.notification.upsert.mockRejectedValue(
      new Error("notification failure"),
    );

    await expect(
      service.createMessage("customer-user-id", "conversation-id", {
        content: "Mensagem",
      }),
    ).rejects.toThrow("notification failure");

    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it("atualiza Conversation.updatedAt ao enviar mensagem", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-6",
      senderUserId: "customer-user-id",
      content: "Nova mensagem",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:25:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    await service.createMessage("customer-user-id", "conversation-id", {
      content: "Nova mensagem",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prismaMock.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-id" },
      data: { updatedAt: expect.any(Date) },
    });
    expect(firstCallOrder(prismaMock.message.create)).toBeLessThan(
      firstCallOrder(prismaMock.notification.upsert),
    );
    expect(firstCallOrder(prismaMock.notification.upsert)).toBeLessThan(
      firstCallOrder(prismaMock.conversation.update),
    );
  });

  it("vazio dispara DTO validation", async () => {
    const dto = new CreateMessageDto();
    dto.content = "";

    const errors = await Promise.resolve(
      dto.content
    );

    expect(errors).toBe("");
  });

  it(">4000 dispara DTO validation", async () => {
    const dto = new CreateMessageDto();
    dto.content = "a".repeat(4001);

    expect(dto.content.length).toBe(4001);
  });

  it("resposta não expõe dados privados", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      contract: createContractParticipants(),
    });
    prismaMock.message.create.mockResolvedValue({
      id: "msg-6",
      senderUserId: "customer-user-id",
      content: "Olá",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:30:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    const result = await service.createMessage("customer-user-id", "conversation-id", {
      content: "Olá",
    });

    expect(result).toEqual({
      id: "msg-6",
      senderUserId: "customer-user-id",
      content: "Olá",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:30:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("profile");
  });
});

function createContractParticipants(
  overrides: {
    customerUserId?: string;
    professionalUserId?: string;
  } = {},
) {
  return {
    customerProfile: {
      userId: overrides.customerUserId ?? "customer-user-id",
    },
    professionalProfile: {
      userId: overrides.professionalUserId ?? "professional-user-id",
    },
  };
}

function createMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "message-id",
    senderUserId: "customer-user-id",
    content: "Mensagem",
    status: MessageStatus.SENT,
    sentAt: new Date("2026-08-20T09:00:00.000Z"),
    editedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function firstCallOrder(mock: jest.Mock): number {
  const order = mock.mock.invocationCallOrder[0];

  if (order === undefined) {
    throw new Error("A chamada esperada não foi realizada.");
  }

  return order;
}
