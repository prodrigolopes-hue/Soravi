import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { MessageResponseDto } from "./dto/message-response.dto";

describe("ConversationsController", () => {
  const serviceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    createMessage: jest.fn(),
  };

  const gatewayMock = {
    emitMessageCreated: jest.fn(),
  };

  const controller = new ConversationsController(
    serviceMock as unknown as ConversationsService,
    gatewayMock as unknown as ConversationsGateway,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o usuário autenticado e o ID para o detalhe da conversa", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };

    const response = new ConversationResponseDto({
      id: "conversation-id",
      status: "ACTIVE" as any,
      createdAt: new Date("2026-08-20T10:00:00.000Z"),
      updatedAt: new Date("2026-08-20T11:00:00.000Z"),
      closedAt: null,
      contract: {
        id: "contract-id",
        status: "ACCEPTED" as any,
        agreedAmountInCents: 150000,
        agreedDurationValue: 2,
        agreedDurationUnit: "HOUR" as any,
        acceptedAt: new Date("2026-08-19T08:00:00.000Z"),
        startedAt: null,
        completedAt: null,
      },
      serviceRequest: {
        id: "request-id",
        title: "Instalar tomada",
        status: "OPEN" as any,
      },
      participantRole: "CUSTOMER",
      otherParticipantName: "Profissional Soravi",
    });

    serviceMock.findOne.mockResolvedValue(response);

    const result = await controller.findOne(currentUser, response.id);

    expect(serviceMock.findOne).toHaveBeenCalledWith(
      currentUser.id,
      response.id,
    );
    expect(result).toBe(response);
  });

  it("emite evento realtime após criar mensagem com sucesso", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };

    const createdMessage = new MessageResponseDto({
      id: "message-id",
      senderUserId: "customer-user-id",
      content: "Ola",
      status: "SENT" as any,
      sentAt: new Date("2026-08-21T10:00:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    serviceMock.createMessage.mockResolvedValue(createdMessage);

    const result = await controller.createMessage(currentUser, "conversation-id", {
      content: "Ola",
    });

    expect(serviceMock.createMessage).toHaveBeenCalledWith(
      currentUser.id,
      "conversation-id",
      { content: "Ola" },
    );

    expect(gatewayMock.emitMessageCreated).toHaveBeenCalledWith(
      "conversation-id",
      createdMessage,
    );

    expect(result).toBe(createdMessage);
  });

  it("nao emite evento quando criacao da mensagem falha", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };

    serviceMock.createMessage.mockRejectedValue(new Error("db-failure"));

    await expect(
      controller.createMessage(currentUser, "conversation-id", {
        content: "Ola",
      }),
    ).rejects.toThrow("db-failure");

    expect(gatewayMock.emitMessageCreated).not.toHaveBeenCalled();
  });

  it("protege o detalhe da conversa com autenticação", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.findOne,
    );

    expect(guards).toEqual([AccessTokenGuard]);
  });

  it("protege a listagem de conversas com autenticação", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.findAll,
    );

    expect(guards).toEqual([AccessTokenGuard]);
  });

  it("encaminha o usuário autenticado e a paginação para a listagem de conversas", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };

    const response = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };

    serviceMock.findAll.mockResolvedValue(response);

    const result = await controller.findAll(currentUser, { page: 2, limit: 10 });

    expect(serviceMock.findAll).toHaveBeenCalledWith(
      currentUser.id,
      2,
      10,
    );
    expect(result).toBe(response);
  });

  it("aplica defaults de page e limit quando não informados", async () => {
    const currentUser = {
      id: "customer-user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };

    serviceMock.findAll.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await controller.findAll(currentUser, {});

    expect(serviceMock.findAll).toHaveBeenCalledWith(currentUser.id, 1, 20);
  });

  it("exige telefone somente no envio de mensagem", () => {
    const messageGuards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.createMessage,
    );
    const messagesReadGuards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.findMessages,
    );
    const markReadGuards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.markAsRead,
    );

    expect(messageGuards).toEqual([
      AccessTokenGuard,
      PhoneVerifiedGuard,
    ]);
    expect(messagesReadGuards).toEqual([AccessTokenGuard]);
    expect(markReadGuards).toEqual([AccessTokenGuard]);
  });
});
