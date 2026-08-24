import "reflect-metadata";

import {
  ContractStatus,
  ConversationStatus,
  MessageStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ConversationsService } from "./conversations.service";

describe("ConversationsService.findAll", () => {
  let service: ConversationsService;
  let prismaMock: {
    conversation: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const buildConversation = (overrides: Record<string, unknown> = {}) => ({
    id: "conversation-id",
    status: ConversationStatus.ACTIVE,
    updatedAt: new Date("2026-08-20T11:00:00.000Z"),
    contract: {
      status: ContractStatus.ACCEPTED,
      serviceRequest: {
        id: "request-id",
        title: "Instalar tomada",
      },
    },
    messages: [
      {
        id: "msg-1",
        senderUserId: "professional-user-id",
        content: "Posso ir amanhã",
        status: MessageStatus.SENT,
        sentAt: new Date("2026-08-20T10:30:00.000Z"),
      },
    ],
    readStates: [],
    ...overrides,
  });

  beforeEach(() => {
    prismaMock = {
      conversation: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations: unknown[]) =>
        Promise.all(
          (operations as Promise<unknown>[]).map((operation) => operation),
        ),
      ),
    };

    service = new ConversationsService(prismaMock as unknown as PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it("lista somente conversas do usuário autenticado (filtro por ownership)", async () => {
    prismaMock.conversation.count.mockResolvedValue(0);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    await service.findAll("customer-user-id", 1, 20);

    expect(prismaMock.conversation.count).toHaveBeenCalledWith({
      where: {
        contract: {
          OR: [
            { customerProfile: { userId: "customer-user-id" } },
            { professionalProfile: { userId: "customer-user-id" } },
          ],
        },
      },
    });
    expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contract: {
            OR: [
              { customerProfile: { userId: "customer-user-id" } },
              { professionalProfile: { userId: "customer-user-id" } },
            ],
          },
        },
      }),
    );
  });

  it("CUSTOMER participante recebe a lista", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([buildConversation()]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "conversation-id",
      status: ConversationStatus.ACTIVE,
      serviceRequest: { id: "request-id", title: "Instalar tomada" },
      contract: { status: ContractStatus.ACCEPTED },
    });
  });

  it("PROFESSIONAL participante recebe a lista", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([buildConversation()]);

    const result = await service.findAll("professional-user-id", 1, 20);

    expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contract: {
            OR: [
              { customerProfile: { userId: "professional-user-id" } },
              { professionalProfile: { userId: "professional-user-id" } },
            ],
          },
        },
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it("aplica paginação com page/limit reutilizando o padrão offset", async () => {
    prismaMock.conversation.count.mockResolvedValue(45);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await service.findAll("customer-user-id", 3, 10);

    expect(prismaMock.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it("retorna a última mensagem correta", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([
      buildConversation({
        messages: [
          {
            id: "msg-latest",
            senderUserId: "customer-user-id",
            content: "Última mensagem",
            status: MessageStatus.SENT,
            sentAt: new Date("2026-08-20T12:00:00.000Z"),
          },
        ],
      }),
    ]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items[0].lastMessage).toMatchObject({
      id: "msg-latest",
      senderUserId: "customer-user-id",
      content: "Última mensagem",
      status: MessageStatus.SENT,
    });
  });

  it("conversa sem mensagem retorna lastMessage null", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([
      buildConversation({ messages: [] }),
    ]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items[0].lastMessage).toBeNull();
    expect(result.items[0].hasUnread).toBe(false);
  });

  it("hasUnread true quando a última mensagem não foi lida", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([
      buildConversation({
        messages: [
          {
            id: "msg-unread",
            senderUserId: "professional-user-id",
            content: "Mensagem nova",
            status: MessageStatus.SENT,
            sentAt: new Date("2026-08-20T12:00:00.000Z"),
          },
        ],
        readStates: [],
      }),
    ]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items[0].hasUnread).toBe(true);
  });

  it("hasUnread false quando o read state comprova leitura", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([
      buildConversation({
        messages: [
          {
            id: "msg-read",
            senderUserId: "professional-user-id",
            content: "Mensagem já lida",
            status: MessageStatus.SENT,
            sentAt: new Date("2026-08-20T12:00:00.000Z"),
          },
        ],
        readStates: [{ lastReadMessageId: "msg-read" }],
      }),
    ]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items[0].hasUnread).toBe(false);
  });

  it("própria última mensagem não gera unread", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([
      buildConversation({
        messages: [
          {
            id: "msg-own",
            senderUserId: "customer-user-id",
            content: "Minha própria mensagem",
            status: MessageStatus.SENT,
            sentAt: new Date("2026-08-20T12:00:00.000Z"),
          },
        ],
        readStates: [],
      }),
    ]);

    const result = await service.findAll("customer-user-id", 1, 20);

    expect(result.items[0].hasUnread).toBe(false);
  });

  it("não retorna dados privados extras (profileId, email, telefone)", async () => {
    prismaMock.conversation.count.mockResolvedValue(1);
    prismaMock.conversation.findMany.mockResolvedValue([buildConversation()]);

    const result = await service.findAll("customer-user-id", 1, 20);

    const item = result.items[0] as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty("customerProfileId");
    expect(item).not.toHaveProperty("professionalProfileId");
    expect(item).not.toHaveProperty("email");
    expect(item).not.toHaveProperty("phone");
    expect(item.contract).toEqual({ status: ContractStatus.ACCEPTED });
  });
});
