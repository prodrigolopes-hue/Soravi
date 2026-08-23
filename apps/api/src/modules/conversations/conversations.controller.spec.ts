import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { MessageResponseDto } from "./dto/message-response.dto";

describe("ConversationsController", () => {
  const serviceMock = {
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
      },
      serviceRequest: {
        id: "request-id",
        title: "Instalar tomada",
        status: "OPEN" as any,
      },
      participantRole: "CUSTOMER",
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
});
