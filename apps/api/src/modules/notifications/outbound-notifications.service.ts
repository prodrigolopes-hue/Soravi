import { Injectable } from "@nestjs/common";

import {
  CommunicationChannel,
  NotificationType,
  OutboundNotification,
  OutboundNotificationStatus,
  Prisma,
} from "../../generated/prisma/client";

export interface CreatePendingOutboundNotificationInput {
  transaction: Prisma.TransactionClient;
  notificationId: string;
  userId: string;
  channel: CommunicationChannel;
  eventType: NotificationType;
}

@Injectable()
export class OutboundNotificationsService {
  createPending(
    input: CreatePendingOutboundNotificationInput,
  ): Promise<OutboundNotification> {
    return input.transaction.outboundNotification.upsert({
      where: {
        notificationId_channel: {
          notificationId: input.notificationId,
          channel: input.channel,
        },
      },
      update: {},
      create: {
        notificationId: input.notificationId,
        userId: input.userId,
        channel: input.channel,
        eventType: input.eventType,
        status: OutboundNotificationStatus.PENDING,
        attemptCount: 0,
      },
    });
  }
}
