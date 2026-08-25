import {
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
import { NotificationsListResponseDto } from "./dto/notifications-list-response.dto";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsListResponseDto> {
    return this.notificationsService.findAll(
      currentUser.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post(":notificationId/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  async markAsRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("notificationId", new ParseUUIDPipe()) notificationId: string,
  ): Promise<void> {
    await this.notificationsService.markAsRead(currentUser.id, notificationId);
  }
}
