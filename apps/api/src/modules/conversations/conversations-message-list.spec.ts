import "reflect-metadata";

import { MessageStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ConversationsService } from "./conversations.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

describe("ConversationsService.findMessages", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: { findFirst: jest.Mock };
    message: { findFirst: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prismaMock = {
      conversation: { findFirst: jest.fn() },
      message: { findFirst: jest.fn(), findMany: jest.fn() },
    };

    service = new ConversationsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it("CUSTOMER participante lista", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: "msg-1",
        senderUserId: "customer-user-id",
        content: "Olá",
        status: MessageStatus.SENT,
        sentAt: new Date("2026-08-20T09:00:00.000Z"),
        editedAt: null,
        deletedAt: null,
      },
    ]);

    const result = await service.findMessages("customer-user-id", "conversation-id");

    expect(result.data[0]).toMatchObject({ id: "msg-1", senderUserId: "customer-user-id" });
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
  });

  it("PROFESSIONAL participante lista", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([]);

    const result = await service.findMessages("professional-user-id", "conversation-id");

    expect(result.data).toEqual([]);
    expect(result.meta.nextCursor).toBeNull();
  });

  it("outro usuário retorna 404 neutro", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findMessages("other-user-id", "conversation-id"),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("conversation inexistente retorna 404", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);

    await expect(
      service.findMessages("customer-user-id", "missing-conversation-id"),
    ).rejects.toBeInstanceOf(ConversationNotFoundException);
  });

  it("usa default limit de 30", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.findMessages("customer-user-id", "conversation-id");

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 31,
      }),
    );
  });

  it("limita no máximo 100", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.findMessages("customer-user-id", "conversation-id", undefined, "300");

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 101,
      }),
    );
  });

  it("aceita cursor da própria conversa", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue({
      id: "msg-2",
      sentAt: new Date("2026-08-20T09:30:00.000Z"),
    });
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.findMessages("customer-user-id", "conversation-id", "msg-2");

    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: "msg-2",
        conversationId: "conversation-id",
      },
      select: {
        id: true,
        sentAt: true,
      },
    });
  });

  it("cursor de outra conversa invalida", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findFirst.mockResolvedValue(null);

    await expect(
      service.findMessages("customer-user-id", "conversation-id", "other-message-id"),
    ).rejects.toMatchObject({
      message: "Cursor inválido para a conversa informada.",
      response: {
        code: "INVALID_MESSAGE_CURSOR",
        message: "Cursor inválido para a conversa informada.",
      },
    });

    try {
      await service.findMessages("customer-user-id", "conversation-id", "other-message-id");
    } catch (error: unknown) {
      const exception = error as { getStatus: () => number; response: { code: string; message: string } };
      expect(exception.getStatus()).toBe(400);
      expect(exception.response).toEqual({
        code: "INVALID_MESSAGE_CURSOR",
        message: "Cursor inválido para a conversa informada.",
      });
    }
  });

  it("hasMore e nextCursor são calculados corretamente", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([
      { id: "msg-3", senderUserId: "c", content: "more", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T10:00:00.000Z"), editedAt: null, deletedAt: null },
      { id: "msg-2", senderUserId: "b", content: "newer", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T09:00:00.000Z"), editedAt: null, deletedAt: null },
      { id: "msg-1", senderUserId: "a", content: "older", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T08:00:00.000Z"), editedAt: null, deletedAt: null },
    ]);

    const result = await service.findMessages("customer-user-id", "conversation-id", undefined, "2");

    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.nextCursor).toBe("msg-2");
    expect(result.data.map((item) => item.id)).toEqual(["msg-2", "msg-3"]);
  });

  it("ordem final é cronológica crescente", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([
      { id: "msg-3", senderUserId: "c", content: "mais recente", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T10:00:00.000Z"), editedAt: null, deletedAt: null },
      { id: "msg-2", senderUserId: "b", content: "meio", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T09:00:00.000Z"), editedAt: null, deletedAt: null },
      { id: "msg-1", senderUserId: "a", content: "mais antiga", status: MessageStatus.SENT, sentAt: new Date("2026-08-20T08:00:00.000Z"), editedAt: null, deletedAt: null },
    ]);

    const result = await service.findMessages("customer-user-id", "conversation-id", undefined, "3");

    expect(result.data.map((item) => item.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
  });

  it("não altera read state", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.findMessages("customer-user-id", "conversation-id");

    expect(prismaMock.message.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: "conversation-id",
          userId: expect.any(String),
        }),
      }),
    );
  });

  it("resposta não expõe dados privados", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue({ id: "conversation-id" });
    prismaMock.message.findMany.mockResolvedValue([
      {
        id: "msg-1",
        senderUserId: "customer-user-id",
        content: "Olá",
        status: MessageStatus.SENT,
        sentAt: new Date("2026-08-20T09:00:00.000Z"),
        editedAt: null,
        deletedAt: null,
      },
    ]);

    const result = await service.findMessages("customer-user-id", "conversation-id");

    expect(result.data[0]).toEqual({
      id: "msg-1",
      senderUserId: "customer-user-id",
      content: "Olá",
      status: MessageStatus.SENT,
      sentAt: new Date("2026-08-20T09:00:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });
    expect(result.data[0]).not.toHaveProperty("email");
    expect(result.data[0]).not.toHaveProperty("phone");
    expect(result.data[0]).not.toHaveProperty("profile");
  });
});
