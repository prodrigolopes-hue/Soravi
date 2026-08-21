import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
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
}
