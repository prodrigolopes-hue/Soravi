import { WsException } from "@nestjs/websockets";

import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

describe("ConversationsGateway", () => {
  let gateway: ConversationsGateway;

  let accessTokenAuthServiceMock: {
    extractBearerToken: jest.Mock;
    authenticateAccessToken: jest.Mock;
  };

  let conversationsServiceMock: {
    assertParticipant: jest.Mock;
  };

  beforeEach(() => {
    accessTokenAuthServiceMock = {
      extractBearerToken: jest.fn(),
      authenticateAccessToken: jest.fn(),
    };

    conversationsServiceMock = {
      assertParticipant: jest.fn(),
    };

    gateway = new ConversationsGateway(
      accessTokenAuthServiceMock as unknown as AccessTokenAuthService,
      conversationsServiceMock as unknown as ConversationsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("participante autenticado pode entrar na sala", async () => {
    const socket = createSocketMock();

    accessTokenAuthServiceMock.extractBearerToken.mockReturnValue("access-token");
    accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });

    await gateway.handleConnection(socket as any);

    await gateway.joinConversation(socket as any, {
      conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
    });

    expect(conversationsServiceMock.assertParticipant).toHaveBeenCalledWith(
      "user-id",
      "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
    );

    expect(socket.join).toHaveBeenCalledWith(
      ConversationsGateway.buildRoomName("8ad56b37-893c-4255-9a5f-62d4e7d17d65"),
    );
  });

  it("nao participante nao entra na sala", async () => {
    const socket = createSocketMock();

    accessTokenAuthServiceMock.extractBearerToken.mockReturnValue("access-token");
    accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });

    conversationsServiceMock.assertParticipant.mockRejectedValue(
      new ConversationNotFoundException(),
    );

    await gateway.handleConnection(socket as any);

    await expect(
      gateway.joinConversation(socket as any, {
        conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
      }),
    ).rejects.toBeInstanceOf(WsException);

    expect(socket.join).not.toHaveBeenCalled();
  });

  it("emite evento na sala correta com payload minimo sem dados extras", () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });

    (gateway as any).server = { to };

    gateway.emitMessageCreated("8ad56b37-893c-4255-9a5f-62d4e7d17d65", {
      id: "message-id",
      senderUserId: "sender-user-id",
      content: "Mensagem",
      status: "SENT" as any,
      sentAt: new Date("2026-08-21T10:00:00.000Z"),
      editedAt: null,
      deletedAt: null,
    });

    expect(to).toHaveBeenCalledWith(
      "conversation:8ad56b37-893c-4255-9a5f-62d4e7d17d65",
    );

    const payload = emit.mock.calls[0][1];

    expect(emit.mock.calls[0][0]).toBe("conversation.message.created");
    expect(payload).toStrictEqual({
      conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
      message: {
        id: "message-id",
        senderUserId: "sender-user-id",
        content: "Mensagem",
        status: "SENT",
        sentAt: new Date("2026-08-21T10:00:00.000Z"),
        editedAt: null,
        deletedAt: null,
      },
    });

    expect(Object.keys(payload.message)).toEqual([
      "id",
      "senderUserId",
      "content",
      "status",
      "sentAt",
      "editedAt",
      "deletedAt",
    ]);
  });

  function createSocketMock() {
    return {
      handshake: {
        headers: {
          authorization: "Bearer access-token",
        },
      },
      data: {},
      disconnect: jest.fn(),
      join: jest.fn(),
    };
  }
});
