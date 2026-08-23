import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { InvalidAccessTokenException } from "../auth/errors/invalid-access-token.exception";
import { MessageStatus } from "../../generated/prisma/client";
import { Namespace, Socket } from "socket.io";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

interface SocketMock {
  handshake: {
    auth: {
      accessToken?: string;
    };
    headers: {
      authorization?: string;
    };
  };
  data: Record<string, unknown>;
  disconnect: jest.Mock;
  join: jest.Mock;
}

type SocketMiddleware = (
  socket: Socket,
  next: (error?: Error) => void,
) => void | Promise<void>;

describe("ConversationsGateway", () => {
  let gateway: ConversationsGateway;

  let accessTokenAuthServiceMock: {
    extractBearerToken: jest.Mock;
    authenticateAccessToken: jest.Mock;
  };

  let conversationsServiceMock: {
    assertParticipant: jest.Mock;
  };

  let socketMiddleware: SocketMiddleware;

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

    gateway.afterInit({
      use: jest.fn((middleware: SocketMiddleware) => {
        socketMiddleware = middleware;
      }),
    } as unknown as Namespace);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("participante autenticado pode entrar na sala", async () => {
    const socket = createSocketMock();

    accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });

    await runSocketMiddleware(socket);

    const acknowledge = jest.fn();

    await gateway.joinConversation(
      socket as unknown as Socket,
      { conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65" },
      acknowledge,
    );

    expect(conversationsServiceMock.assertParticipant).toHaveBeenCalledWith(
      "user-id",
      "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
    );

    expect(socket.join).toHaveBeenCalledWith(
      ConversationsGateway.buildRoomName("8ad56b37-893c-4255-9a5f-62d4e7d17d65"),
    );
    expect(socket.data.user).toEqual({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });
    expect(acknowledge).toHaveBeenCalledWith({
      ok: true,
      conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65",
    });
    expect(
      accessTokenAuthServiceMock.authenticateAccessToken,
    ).toHaveBeenCalledWith("access-token");
    expect(accessTokenAuthServiceMock.extractBearerToken).not.toHaveBeenCalled();
  });

  it("nao participante nao entra na sala", async () => {
    const socket = createSocketMock();

    accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });

    conversationsServiceMock.assertParticipant.mockRejectedValue(
      new ConversationNotFoundException(),
    );

    await runSocketMiddleware(socket);

    const acknowledge = jest.fn();

    await gateway.joinConversation(
      socket as unknown as Socket,
      { conversationId: "8ad56b37-893c-4255-9a5f-62d4e7d17d65" },
      acknowledge,
    );

    expect(socket.join).not.toHaveBeenCalled();
    expect(acknowledge).toHaveBeenCalledWith({
      ok: false,
      code: "CONVERSATION_NOT_FOUND",
    });
  });

  it("rejeita conexao sem access token", async () => {
    const socket = createSocketMock();
    socket.handshake.auth = {};
    socket.handshake.headers = {};

    await expect(runSocketMiddleware(socket)).rejects.toThrow("unauthorized");

    expect(socket.data.user).toBeUndefined();
    expect(socket.join).not.toHaveBeenCalled();
    expect(
      accessTokenAuthServiceMock.authenticateAccessToken,
    ).not.toHaveBeenCalled();
  });

  it("rejeita conexao com access token invalido", async () => {
    const socket = createSocketMock();

    accessTokenAuthServiceMock.authenticateAccessToken.mockRejectedValue(
      new InvalidAccessTokenException(),
    );

    await expect(runSocketMiddleware(socket)).rejects.toThrow("unauthorized");

    expect(socket.data.user).toBeUndefined();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("mantem Authorization como fallback", async () => {
    const socket = createSocketMock();
    socket.handshake.auth = {};

    accessTokenAuthServiceMock.extractBearerToken.mockReturnValue("access-token");
    accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
      id: "user-id",
      sessionId: "session-id",
      roles: [],
    });

    await runSocketMiddleware(socket);

    expect(accessTokenAuthServiceMock.extractBearerToken).toHaveBeenCalledWith(
      "Bearer access-token",
    );
    expect(
      accessTokenAuthServiceMock.authenticateAccessToken,
    ).toHaveBeenCalledWith("access-token");
  });

  it("emite evento na sala correta com payload minimo sem dados extras", () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });

    const gatewayWithServer = gateway as unknown as { server: Namespace };
    gatewayWithServer.server = { to } as unknown as Namespace;

    gateway.emitMessageCreated("8ad56b37-893c-4255-9a5f-62d4e7d17d65", {
      id: "message-id",
      senderUserId: "sender-user-id",
      content: "Mensagem",
      status: MessageStatus.SENT,
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

  function createSocketMock(): SocketMock {
    return {
      handshake: {
        auth: {
          accessToken: "access-token",
        },
        headers: {
          authorization: "Bearer access-token",
        },
      },
      data: {},
      disconnect: jest.fn(),
      join: jest.fn(),
    };
  }

  function runSocketMiddleware(socket: SocketMock): Promise<void> {
    return new Promise((resolve, reject) => {
      socketMiddleware(socket as unknown as Socket, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
