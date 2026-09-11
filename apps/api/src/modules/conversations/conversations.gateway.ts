import { OnModuleDestroy } from "@nestjs/common";
import {
  Ack,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { isUUID } from "class-validator";
import { Namespace, Socket } from "socket.io";

import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { AuthSessionsRevokedNotifier } from "../auth/auth-sessions-revoked.notifier";
import { InvalidAccessTokenException } from "../auth/errors/invalid-access-token.exception";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { MessageResponseDto } from "./dto/message-response.dto";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";
import { ConversationsService } from "./conversations.service";

interface JoinConversationInput {
  conversationId: string;
}

interface JoinConversationAck {
  ok: boolean;
  conversationId?: string;
  code?: string;
}

type JoinConversationAcknowledgement = (
  response: JoinConversationAck,
) => void;

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedUser;
  };
};

@WebSocketGateway({
  namespace: "/conversations",
})
export class ConversationsGateway
  implements OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer()
  private server?: Namespace;

  private unsubscribeSessionsRevoked?: () => void;

  constructor(
    private readonly accessTokenAuthService: AccessTokenAuthService,
    private readonly conversationsService: ConversationsService,
    private readonly sessionsRevokedNotifier: AuthSessionsRevokedNotifier,
  ) {}

  afterInit(server: Namespace): void {
    this.unsubscribeSessionsRevoked?.();

    this.unsubscribeSessionsRevoked =
      this.sessionsRevokedNotifier.subscribe((userId) => {
        this.disconnectUserSockets(server, userId);
      });

    server.use(async (client: Socket, next): Promise<void> => {
      const accessToken = this.readAccessToken(client);

      if (!accessToken) {
        next(new Error("unauthorized"));
        return;
      }

      try {
        client.data.user =
          await this.accessTokenAuthService.authenticateAccessToken(
            accessToken,
          );

        next();
      } catch (error: unknown) {
        if (error instanceof InvalidAccessTokenException) {
          next(new Error("unauthorized"));
          return;
        }

        next(new Error("unauthorized"));
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribeSessionsRevoked?.();
    this.unsubscribeSessionsRevoked = undefined;
  }

  @SubscribeMessage("conversation.join")
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() input: JoinConversationInput,
    @Ack() acknowledge?: JoinConversationAcknowledgement,
  ): Promise<void> {
    const currentUser = client.data.user;

    if (!currentUser) {
      acknowledge?.({
        ok: false,
        code: "INVALID_ACCESS_TOKEN",
      });
      return;
    }

    if (!input || typeof input.conversationId !== "string") {
      acknowledge?.({
        ok: false,
        code: "INVALID_CONVERSATION_ID",
      });
      return;
    }

    const conversationId = input.conversationId.trim();

    if (!conversationId || !isUUID(conversationId, "4")) {
      acknowledge?.({
        ok: false,
        code: "INVALID_CONVERSATION_ID",
      });
      return;
    }

    try {
      await this.conversationsService.assertParticipant(
        currentUser.id,
        conversationId,
      );
    } catch (error: unknown) {
      if (error instanceof ConversationNotFoundException) {
        acknowledge?.({
          ok: false,
          code: "CONVERSATION_NOT_FOUND",
        });
        return;
      }

      throw error;
    }

    client.join(
      ConversationsGateway.buildRoomName(conversationId),
    );

    acknowledge?.({
      ok: true,
      conversationId,
    });
  }

  emitMessageCreated(
    conversationId: string,
    message: MessageResponseDto,
  ): void {
    this.server
      ?.to(
        ConversationsGateway.buildRoomName(
          conversationId,
        ),
      )
      .emit("conversation.message.created", {
        conversationId,
        message: {
          id: message.id,
          senderUserId: message.senderUserId,
          content: message.content,
          status: message.status,
          sentAt: message.sentAt,
          editedAt: message.editedAt,
          deletedAt: message.deletedAt,
        },
      });
  }

  static buildRoomName(
    conversationId: string,
  ): string {
    return `conversation:${conversationId}`;
  }

  private disconnectUserSockets(
    server: Namespace,
    userId: string,
  ): void {
    for (const socket of server.sockets.values()) {
      const currentUser = (
        socket as AuthenticatedSocket
      ).data.user;

      if (currentUser?.id === userId) {
        socket.disconnect(true);
      }
    }
  }

  private readAccessToken(
    client: Socket,
  ): string | undefined {
    const authAccessToken =
      client.handshake.auth?.accessToken;

    if (
      typeof authAccessToken === "string" &&
      authAccessToken.trim()
    ) {
      return authAccessToken.trim();
    }

    return (
      this.accessTokenAuthService.extractBearerToken(
        this.readAuthorizationHeader(client),
      ) ?? undefined
    );
  }

  private readAuthorizationHeader(
    client: Socket,
  ): string | undefined {
    const authorizationHeader =
      client.handshake.headers.authorization;

    if (typeof authorizationHeader === "string") {
      return authorizationHeader;
    }

    if (Array.isArray(authorizationHeader)) {
      return authorizationHeader[0];
    }

    return undefined;
  }
}