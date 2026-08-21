import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { ConversationResponseDto } from "./dto/conversation-response.dto";

describe("ConversationsController", () => {
  const serviceMock = {
    findOne: jest.fn(),
  };

  const controller = new ConversationsController(
    serviceMock as unknown as ConversationsService,
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

  it("protege o detalhe da conversa com autenticação", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ConversationsController.prototype.findOne,
    );

    expect(guards).toEqual([AccessTokenGuard]);
  });
});
