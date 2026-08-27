import { Injectable } from "@nestjs/common";

import {
  CommunicationChannel,
  NotificationType,
  OutboundNotification,
  OutboundNotificationStatus,
  Prisma,
  UserStatus,
} from "../../generated/prisma/client";

export interface CreatePendingOutboundNotificationInput {
  transaction: Prisma.TransactionClient;
  notificationId: string;
  userId: string;
  channel: CommunicationChannel;
  eventType: NotificationType;
}

export interface OutboundNotificationEligibilityCandidate {
  outbound: {
    id: string;
    userId: string;
    notificationId: string;
    channel: CommunicationChannel;
    eventType: NotificationType;
    status: OutboundNotificationStatus;
    nextAttemptAt: Date | null;
  };
  user: {
    id: string;
    status: UserStatus;
    deletedAt: Date | null;
    phoneNormalized: string | null;
    phoneVerifiedAt: Date | null;
  } | null;
  preference: {
    enabled: boolean;
    channel: CommunicationChannel;
    eventType: NotificationType;
  } | null;
  notification: {
    id: string;
    userId: string;
    deletedAt: Date | null;
  } | null;
}

@Injectable()
export class OutboundNotificationsService {
  async findEligibilityCandidates(
    transaction: Prisma.TransactionClient,
    limit: number,
  ): Promise<OutboundNotificationEligibilityCandidate[]> {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "outbound_notifications"
        WHERE "status" = ${OutboundNotificationStatus.PENDING}::"OutboundNotificationStatus"
          AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= NOW())
        ORDER BY "created_at" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      `,
    );

    if (lockedRows.length === 0) {
      return [];
    }

    const candidates = await transaction.outboundNotification.findMany({
      where: { id: { in: lockedRows.map(({ id }) => id) } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        userId: true,
        notificationId: true,
        channel: true,
        eventType: true,
        status: true,
        nextAttemptAt: true,
        user: {
          select: {
            id: true,
            status: true,
            deletedAt: true,
            phoneNormalized: true,
            phoneVerifiedAt: true,
            communicationPreferences: {
              select: { enabled: true, channel: true, eventType: true },
            },
          },
        },
        notification: {
          select: { id: true, userId: true, deletedAt: true },
        },
      },
    });

    return candidates.map(({ user, notification, ...outbound }) => ({
      outbound,
      user: user
        ? {
            id: user.id,
            status: user.status,
            deletedAt: user.deletedAt,
            phoneNormalized: user.phoneNormalized,
            phoneVerifiedAt: user.phoneVerifiedAt,
          }
        : null,
      preference:
        user?.communicationPreferences.find(
          (preference) =>
            preference.channel === outbound.channel &&
            preference.eventType === outbound.eventType,
        ) ?? null,
      notification,
    }));
  }

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
