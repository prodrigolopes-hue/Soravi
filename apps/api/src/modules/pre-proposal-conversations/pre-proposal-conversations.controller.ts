import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreatePreProposalMessageDto } from "./dto/create-pre-proposal-message.dto";
import { PreProposalConversationMessagesQueryDto } from "./dto/pre-proposal-conversation-messages-query.dto";
import { PreProposalConversationsQueryDto } from "./dto/pre-proposal-conversations-query.dto";
import { PreProposalConversationsService } from "./pre-proposal-conversations.service";

@Controller()
export class PreProposalConversationsController {
  constructor(private readonly service: PreProposalConversationsService) {}

  @Post("opportunities/:opportunityId/pre-proposal-conversation/messages")
  @UseGuards(AccessTokenGuard, PhoneVerifiedGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("opportunityId", new ParseUUIDPipe()) opportunityId: string,
    @Body() input: CreatePreProposalMessageDto,
  ) {
    return this.service.start(user.id, opportunityId, input.content);
  }

  @Get("pre-proposal-conversations/:conversationId")
  @UseGuards(AccessTokenGuard)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("conversationId", new ParseUUIDPipe()) conversationId: string) {
    return this.service.findOne(user.id, conversationId);
  }

  @Get("opportunities/:opportunityId/pre-proposal-conversations")
  @UseGuards(AccessTokenGuard)
  findForOpportunity(
    @CurrentUser() user: AuthenticatedUser,
    @Param("opportunityId", new ParseUUIDPipe()) opportunityId: string,
  ) {
    return this.service.findForOpportunity(user.id, opportunityId);
  }

  @Get("service-requests/:serviceRequestId/pre-proposal-conversations")
  @UseGuards(AccessTokenGuard)
  findForServiceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Query() query: PreProposalConversationsQueryDto,
  ) {
    return this.service.findForServiceRequest(user.id, serviceRequestId, query.page ?? 1, query.limit ?? 20);
  }

  @Get("pre-proposal-conversations/:conversationId/messages")
  @UseGuards(AccessTokenGuard)
  findMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: PreProposalConversationMessagesQueryDto,
  ) {
    return this.service.findMessages(user.id, conversationId, query.before, query.limit);
  }

  @Post("pre-proposal-conversations/:conversationId/response")
  @UseGuards(AccessTokenGuard, PhoneVerifiedGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FilesInterceptor("photos", 5, { limits: { fileSize: 5 * 1024 * 1024 } }))
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() input: CreatePreProposalMessageDto,
    @UploadedFiles() files: Array<{ buffer: Buffer; originalname: string; mimetype: string; size: number }> | undefined,
  ) {
    return this.service.respond(user.id, conversationId, input.content, files ?? []);
  }
}
