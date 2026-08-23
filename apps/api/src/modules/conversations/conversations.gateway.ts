import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { isUUID } from "class-validator";
import { Server, Socket } from "socket.io";

import { AccessTokenAuthService } from "../auth/access-token-auth.service";
import { InvalidAccessTokenException } from "../auth/errors/invalid-access-token.exception";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { MessageResponseDto } from "./dto/message-response.dto";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";
import { ConversationsService } from "./conversations.service";

interface JoinConversationInput {
  conversationId: string;
}

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthenticatedUser;
  };
};

@WebSocketGateway({
  namespace: "/conversations",
})
export class ConversationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly accessTokenAuthService: AccessTokenAuthService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const accessToken = this.accessTokenAuthService.extractBearerToken(
      this.readAuthorizationHeader(client),
    );

    if (!accessToken) {
      client.disconnect(true);
      return;
    }

    try {
      client.data.user = await this.accessTokenAuthService.authenticateAccessToken(
        accessToken,
      );
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenException) {
        client.disconnect(true);
        return;
      }

      throw error;
    }
  }

  @SubscribeMessage("conversation.join")
  async joinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() input: JoinConversationInput,
  ): Promise<{ conversationId: string }> {
    const currentUser = client.data.user;

    if (!currentUser) {
      throw new WsException({
        code: "INVALID_ACCESS_TOKEN",
        message: "Access token inválido.",
      });
    }

    if (!input || typeof input.conversationId !== "string") {
      throw new WsException({
        code: "INVALID_CONVERSATION_ID",
        message: "Identificador da conversa inválido.",
      });
    }

    const conversationId = input.conversationId.trim();

    if (!conversationId || !isUUID(conversationId, "4")) {
      throw new WsException({
        code: "INVALID_CONVERSATION_ID",
        message: "Identificador da conversa inválido.",
      });
    }

    try {
      await this.conversationsService.assertParticipant(
        currentUser.id,
        conversationId,
      );
    } catch (error: unknown) {
      if (error instanceof ConversationNotFoundException) {
        throw new WsException({
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversa não encontrada.",
        });
      }

      throw error;
    }

    client.join(ConversationsGateway.buildRoomName(conversationId));

    return { conversationId };
  }

  emitMessageCreated(
    conversationId: string,
    message: MessageResponseDto,
  ): void {
    this.server
      ?.to(ConversationsGateway.buildRoomName(conversationId))
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

  static buildRoomName(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private readAuthorizationHeader(client: Socket): string | undefined {
    const authorizationHeader = client.handshake.headers.authorization;

    if (typeof authorizationHeader === "string") {
      return authorizationHeader;
    }

    if (Array.isArray(authorizationHeader)) {
      return authorizationHeader[0];
    }

    return undefined;
  }
}
