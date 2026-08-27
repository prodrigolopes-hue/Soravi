import { Injectable } from "@nestjs/common";

import {
  CommunicationChannel,
  NotificationType,
  OutboundNotificationStatus,
  UserStatus,
} from "../../generated/prisma/client";

export type OutboundNotificationCancellationReason =
  | "OUTBOUND_NOT_PENDING"
  | "UNSUPPORTED_CHANNEL"
  | "UNSUPPORTED_EVENT"
  | "USER_INELIGIBLE"
  | "PHONE_MISSING"
  | "PHONE_NOT_VERIFIED"
  | "PREFERENCE_NOT_FOUND"
  | "PREFERENCE_DISABLED"
  | "NOTIFICATION_NOT_FOUND"
  | "NOTIFICATION_DELETED"
  | "NOTIFICATION_OWNERSHIP_MISMATCH";

export interface OutboundNotificationEligibilityInput {
  outbound: {
    status: OutboundNotificationStatus;
    channel: CommunicationChannel;
    eventType: NotificationType;
    userId: string;
  };
  user: {
    id: string;
    status: UserStatus;
    deletedAt: Date | null;
    phoneNormalized: string | null;
    phoneVerifiedAt: Date | null;
  } | null;
  preference: {
    channel: CommunicationChannel;
    eventType: NotificationType;
    enabled: boolean;
  } | null;
  notification: {
    id: string;
    userId: string;
    deletedAt: Date | null;
  } | null;
}

export type OutboundNotificationEligibilityResult =
  | { status: "READY" }
  | {
      status: "CANCELLED";
      reason: OutboundNotificationCancellationReason;
    };

const SUPPORTED_EVENTS: readonly NotificationType[] = [
  NotificationType.OPPORTUNITY_CREATED,
  NotificationType.PROPOSAL_CREATED,
  NotificationType.MESSAGE_CREATED,
];

const ELIGIBLE_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

@Injectable()
export class OutboundNotificationEligibilityService {
  evaluate(
    input: OutboundNotificationEligibilityInput,
  ): OutboundNotificationEligibilityResult {
    if (input.outbound.status !== OutboundNotificationStatus.PENDING) {
      return { status: "CANCELLED", reason: "OUTBOUND_NOT_PENDING" };
    }

    if (input.outbound.channel !== CommunicationChannel.WHATSAPP) {
      return { status: "CANCELLED", reason: "UNSUPPORTED_CHANNEL" };
    }

    if (!SUPPORTED_EVENTS.includes(input.outbound.eventType)) {
      return { status: "CANCELLED", reason: "UNSUPPORTED_EVENT" };
    }

    if (
      !input.user ||
      input.user.deletedAt !== null ||
      !ELIGIBLE_USER_STATUSES.includes(input.user.status)
    ) {
      return { status: "CANCELLED", reason: "USER_INELIGIBLE" };
    }

    if (input.user.phoneNormalized === null) {
      return { status: "CANCELLED", reason: "PHONE_MISSING" };
    }

    if (input.user.phoneVerifiedAt === null) {
      return { status: "CANCELLED", reason: "PHONE_NOT_VERIFIED" };
    }

    if (!input.preference) {
      return { status: "CANCELLED", reason: "PREFERENCE_NOT_FOUND" };
    }

    if (
      input.preference.channel !== input.outbound.channel ||
      input.preference.eventType !== input.outbound.eventType
    ) {
      return { status: "CANCELLED", reason: "PREFERENCE_NOT_FOUND" };
    }

    if (!input.preference.enabled) {
      return { status: "CANCELLED", reason: "PREFERENCE_DISABLED" };
    }

    if (!input.notification) {
      return { status: "CANCELLED", reason: "NOTIFICATION_NOT_FOUND" };
    }

    if (input.notification.deletedAt !== null) {
      return { status: "CANCELLED", reason: "NOTIFICATION_DELETED" };
    }

    if (input.notification.userId !== input.outbound.userId) {
      return {
        status: "CANCELLED",
        reason: "NOTIFICATION_OWNERSHIP_MISMATCH",
      };
    }

    return { status: "READY" };
  }
}
