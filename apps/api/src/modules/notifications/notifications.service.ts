import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import {
  NotificationListItemProperties,
  NotificationsListResponseDto,
} from "./dto/notifications-list-response.dto";
import { NotificationNotFoundException } from "./errors/notification-not-found.exception";

const NOTIFICATION_LIST_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  resourceType: true,
  resourceId: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationsListResponseDto> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      deletedAt: null,
    };

    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: NOTIFICATION_LIST_SELECT,
      }),
    ]);

    return new NotificationsListResponseDto(
      notifications as NotificationListItemProperties[],
      page,
      limit,
      total,
    );
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        readAt: true,
      },
    });

    if (!notification) {
      throw new NotificationNotFoundException();
    }

    if (notification.readAt !== null) {
      return;
    }

    await this.prisma.notification.updateMany({
      where: {
        id: notification.id,
        userId,
        deletedAt: null,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }
}
