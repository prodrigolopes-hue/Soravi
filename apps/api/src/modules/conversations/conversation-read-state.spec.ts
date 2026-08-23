import "reflect-metadata";

import { BadRequestException, ConflictException, HttpStatus } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

describe("ConversationsService.markAsRead", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: { findFirst: jest.Mock };
    message: { findFirst: jest.Mock };
    conversationReadState: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      conversation: { findFirst: jest.fn() },
      message: { findFirst: jest.fn() },
      conversationReadState: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new ConversationsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it("CUSTOMER participante marca leitura", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-1",
      sentAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    prismaMock.conversationReadState.findUnique.mockResolvedValue(null);
    prismaMock.conversationReadState.upsert.mockResolvedValue({});

    await service.markAsRead("customer-user-id", "conversation-id", {
      lastReadMessageId: "msg-1",
    });

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
      select: { id: true },
    });
    expect(prismaMock.conversationReadState.upsert).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: "conversation-id",
          userId: "customer-user-id",
        },
      },
      create: {
        conversationId: "conversation-id",
        userId: "customer-user-id",
        lastReadMessageId: "msg-1",
        lastReadAt: expect.any(Date),
      },
      update: {
        lastReadMessageId: "msg-1",
        lastReadAt: expect.any(Date),
      },
    });
  });

  it("PROFESSIONAL participante marca leitura", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-2",
      sentAt: new Date("2026-08-20T09:05:00.000Z"),
    });
    prismaMock.conversationReadState.findUnique.mockResolvedValue(null);
    prismaMock.conversationReadState.upsert.mockResolvedValue({});

    await service.markAsRead("professional-user-id", "conversation-id", {
      lastReadMessageId: "msg-2",
    });

    expect(prismaMock.conversationReadState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId_userId: {
            conversationId: "conversation-id",
            userId: "professional-user-id",
          },
        },
      }),
    );
  });

  it("outro usuário recebe 404 neutro", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead("other-user-id", "conversation-id", {
        lastReadMessageId: "msg-1",
      }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("conversation inexistente recebe 404 neutro", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead("customer-user-id", "missing-conversation-id", {
        lastReadMessageId: "msg-1",
      }),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("mensagem de outra conversa retorna erro controlado", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue(null);

    await expect(
      service.markAsRead("customer-user-id", "conversation-id", {
        lastReadMessageId: "other-message-id",
      }),
    ).rejects.toMatchObject({
      response: {
        code: "INVALID_MESSAGE_CURSOR",
        message: "Cursor inválido para a conversa informada.",
      },
    });
    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: "other-message-id",
        conversationId: "conversation-id",
      },
      select: {
        id: true,
        sentAt: true,
      },
    });
  });

  it("primeira leitura cria ConversationReadState", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-1",
      sentAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    prismaMock.conversationReadState.findUnique.mockResolvedValue(null);
    prismaMock.conversationReadState.upsert.mockResolvedValue({});

    await service.markAsRead("customer-user-id", "conversation-id", {
      lastReadMessageId: "msg-1",
    });

    expect(prismaMock.conversationReadState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          conversationId: "conversation-id",
          userId: "customer-user-id",
          lastReadMessageId: "msg-1",
        }),
      }),
    );
  });

  it("leitura posterior atualiza ConversationReadState existente", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-3",
      sentAt: new Date("2026-08-20T09:20:00.000Z"),
    });
    prismaMock.conversationReadState.findUnique.mockResolvedValue({
      lastReadMessage: {
        id: "msg-2",
        sentAt: new Date("2026-08-20T09:10:00.000Z"),
      },
    });
    prismaMock.conversationReadState.upsert.mockResolvedValue({});

    await service.markAsRead("customer-user-id", "conversation-id", {
      lastReadMessageId: "msg-3",
    });

    expect(prismaMock.conversationReadState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          lastReadMessageId: "msg-3",
          lastReadAt: expect.any(Date),
        },
      }),
    );
  });

  it("não permite retroceder o ponto de leitura", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-1",
      sentAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    prismaMock.conversationReadState.findUnique.mockResolvedValue({
      lastReadMessage: {
        id: "msg-3",
        sentAt: new Date("2026-08-20T09:20:00.000Z"),
      },
    });

    await expect(
      service.markAsRead("customer-user-id", "conversation-id", {
        lastReadMessageId: "msg-1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.conversationReadState.upsert).not.toHaveBeenCalled();
  });
});

describe("ConversationsController.markAsRead", () => {
  const serviceMock = {
    markAsRead: jest.fn(),
  };

  const gatewayMock = {
    emitMessageCreated: jest.fn(),
  };

  const controller = new ConversationsController(
    serviceMock as unknown as ConversationsService,
    gatewayMock as unknown as ConversationsGateway,
  );

  afterEach(() => jest.clearAllMocks());

  it("encaminha usuário autenticado, conversa e payload", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
    };
    const payload = { lastReadMessageId: "msg-1" };

    serviceMock.markAsRead.mockResolvedValue(undefined);

    await expect(
      controller.markAsRead(currentUser, "conversation-id", payload),
    ).resolves.toBeUndefined();
    expect(serviceMock.markAsRead).toHaveBeenCalledWith(
      currentUser.id,
      "conversation-id",
      payload,
    );
  });

  it("retorna 204 No Content", () => {
    const statusCode = Reflect.getMetadata(
      "__httpCode__",
      ConversationsController.prototype.markAsRead,
    );

    expect(statusCode).toBe(HttpStatus.NO_CONTENT);
  });

  it("protege a rota com autenticação", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.markAsRead,
    );

    expect(guards).toEqual([AccessTokenGuard]);
  });
});