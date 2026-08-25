import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { NotificationType, Prisma } from "../../generated/prisma/client";
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

    const opportunityIds = notifications
      .filter(
        (notification) =>
          notification.type === NotificationType.OPPORTUNITY_CREATED &&
          notification.resourceType === "SERVICE_OPPORTUNITY",
      )
      .map((notification) => notification.resourceId);
    const proposalIds = notifications
      .filter(
        (notification) =>
          notification.type === NotificationType.PROPOSAL_CREATED &&
          notification.resourceType === "PROPOSAL",
      )
      .map((notification) => notification.resourceId);
    const messageIds = notifications
      .filter(
        (notification) =>
          notification.type === NotificationType.MESSAGE_CREATED &&
          notification.resourceType === "MESSAGE",
      )
      .map((notification) => notification.resourceId);

    const [opportunities, proposals, messages] = await Promise.all([
      this.prisma.serviceOpportunity.findMany({
        where: {
          id: { in: opportunityIds },
          professionalProfile: { userId },
        },
        select: { id: true },
      }),
      this.prisma.proposal.findMany({
        where: {
          id: { in: proposalIds },
          serviceRequest: {
            deletedAt: null,
            customerProfile: { userId },
          },
        },
        select: { id: true, serviceRequestId: true },
      }),
      this.prisma.message.findMany({
        where: {
          id: { in: messageIds },
          conversation: {
            contract: {
              OR: [
                { customerProfile: { userId } },
                { professionalProfile: { userId } },
              ],
            },
          },
        },
        select: { id: true, conversationId: true },
      }),
    ]);
    const opportunityIdsWithAccess = new Set(
      opportunities.map((opportunity) => opportunity.id),
    );
    const proposalServiceRequestIds = new Map<string, string>();

    for (const proposal of proposals) {
      proposalServiceRequestIds.set(proposal.id, proposal.serviceRequestId);
    }
    const messageConversationIds = new Map<string, string>();

    for (const message of messages) {
      messageConversationIds.set(message.id, message.conversationId);
    }
    const items: NotificationListItemProperties[] = notifications.map(
      (notification) => {
        let href: string | null = null;

        if (
          notification.type === NotificationType.OPPORTUNITY_CREATED &&
          notification.resourceType === "SERVICE_OPPORTUNITY" &&
          opportunityIdsWithAccess.has(notification.resourceId)
        ) {
          href = `/profissional/oportunidades/${notification.resourceId}`;
        }

        if (
          notification.type === NotificationType.PROPOSAL_CREATED &&
          notification.resourceType === "PROPOSAL"
        ) {
          const serviceRequestId = proposalServiceRequestIds.get(
            notification.resourceId,
          );

          if (serviceRequestId) {
            href = `/solicitacoes/${serviceRequestId}`;
          }
        }

        if (
          notification.type === NotificationType.MESSAGE_CREATED &&
          notification.resourceType === "MESSAGE"
        ) {
          const conversationId = messageConversationIds.get(
            notification.resourceId,
          );

          if (conversationId) {
            href = `/conversas/${conversationId}`;
          }
        }

        return { ...notification, href };
      },
    );

    return new NotificationsListResponseDto(
      items,
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
