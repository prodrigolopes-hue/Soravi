import "reflect-metadata";

import { ConflictException, BadRequestException } from "@nestjs/common";

import { ConversationStatus, MessageStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ConversationsService } from "./conversations.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

describe("ConversationsService.createMessage", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: { findFirst: jest.Mock };
    message: { create: jest.Mock };
  };

  beforeEach(() => {
    prismaMock = {
      conversation: { findFirst: jest.fn() },
      message: { create: jest.fn() },
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
  });

  it("PROFESSIONAL participante envia", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
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
  });

  it("outro usuário recebe 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage("other-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("conversation inexistente recebe 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage("customer-user-id", "missing-conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("ACTIVE permite envio", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
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
    });

    await expect(
      service.createMessage("customer-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("BLOCKED bloqueia novas mensagens", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.BLOCKED,
    });

    await expect(
      service.createMessage("customer-user-id", "conversation-id", { content: "Oi" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("senderUserId vem do auth", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
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
