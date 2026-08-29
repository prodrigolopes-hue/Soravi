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
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { ConversationsListQueryDto } from "./dto/conversations-list-query.dto";
import { ConversationsListResponseDto } from "./dto/conversations-list-response.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MarkConversationReadDto } from "./dto/mark-conversation-read.dto";
import { MessageListResponseDto } from "./dto/message-list-response.dto";
import { MessageResponseDto } from "./dto/message-response.dto";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationsGateway: ConversationsGateway,
  ) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ConversationsListQueryDto,
  ): Promise<ConversationsListResponseDto> {
    return this.conversationsService.findAll(
      currentUser.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

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
  @UseGuards(AccessTokenGuard, PhoneVerifiedGuard)
  async createMessage(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() input: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    const createdMessage = await this.conversationsService.createMessage(
      currentUser.id,
      conversationId,
      input,
    );

    this.conversationsGateway.emitMessageCreated(conversationId, createdMessage);

    return createdMessage;
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
