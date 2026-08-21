import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MarkConversationReadDto } from "./dto/mark-conversation-read.dto";
import { MessageListResponseDto } from "./dto/message-list-response.dto";
import { MessageResponseDto } from "./dto/message-response.dto";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get(":conversationId")
  @UseGuards(AccessTokenGuard)
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.findOne(currentUser.id, conversationId);
  }

  @Get(":conversationId/messages")
  @UseGuards(AccessTokenGuard)
  findMessages(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query("before", new ParseUUIDPipe({ optional: true })) before?: string,
    @Query("limit") limit?: string,
  ): Promise<MessageListResponseDto> {
    return this.conversationsService.findMessages(
      currentUser.id,
      conversationId,
      before,
      limit,
    );
  }

  @Post(":conversationId/messages")
  @UseGuards(AccessTokenGuard)
  createMessage(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() input: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.conversationsService.createMessage(
      currentUser.id,
      conversationId,
      input,
    );
  }

  @Post(":conversationId/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  async markAsRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() input: MarkConversationReadDto,
  ): Promise<void> {
    await this.conversationsService.markAsRead(
      currentUser.id,
      conversationId,
      input,
    );
  }
}
