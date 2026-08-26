import {
  CommunicationChannel,
  NotificationType,
  OutboundNotificationStatus,
  UserStatus,
} from "../../generated/prisma/client";
import {
  OutboundNotificationCancellationReason,
  OutboundNotificationEligibilityInput,
  OutboundNotificationEligibilityService,
} from "./outbound-notification-eligibility.service";

describe("OutboundNotificationEligibilityService", () => {
  const service = new OutboundNotificationEligibilityService();

  it.each<
    [
      string,
      Partial<OutboundNotificationEligibilityInput>,
      OutboundNotificationCancellationReason,
    ]
  >([
    [
      "outbound fora de PENDING",
      {
        outbound: createOutbound({ status: OutboundNotificationStatus.SENT }),
      },
      "OUTBOUND_NOT_PENDING",
    ],
    ["preferência inexistente", { preference: null }, "PREFERENCE_NOT_FOUND"],
    [
      "preferência desabilitada",
      { preference: { channel: CommunicationChannel.WHATSAPP, enabled: false } },
      "PREFERENCE_DISABLED",
    ],
    ["telefone ausente", { user: createUser({ phoneNormalized: null }) }, "PHONE_MISSING"],
    [
      "telefone não verificado",
      { user: createUser({ phoneVerifiedAt: null }) },
      "PHONE_NOT_VERIFIED",
    ],
    ["usuário inexistente", { user: null }, "USER_INELIGIBLE"],
    [
      "usuário deletado",
      { user: createUser({ deletedAt: new Date() }) },
      "USER_INELIGIBLE",
    ],
    ["usuário suspenso", { user: createUser({ status: UserStatus.SUSPENDED }) }, "USER_INELIGIBLE"],
    ["usuário bloqueado", { user: createUser({ status: UserStatus.BLOCKED }) }, "USER_INELIGIBLE"],
    ["usuário desativado", { user: createUser({ status: UserStatus.DEACTIVATED }) }, "USER_INELIGIBLE"],
    ["notificação inexistente", { notification: null }, "NOTIFICATION_NOT_FOUND"],
    [
      "notificação deletada",
      { notification: createNotification({ deletedAt: new Date() }) },
      "NOTIFICATION_DELETED",
    ],
    [
      "ownership divergente",
      { notification: createNotification({ userId: "other-user-id" }) },
      "NOTIFICATION_OWNERSHIP_MISMATCH",
    ],
    [
      "evento não suportado",
      { outbound: createOutbound({ eventType: NotificationType.MESSAGE_CREATED }) },
      "UNSUPPORTED_EVENT",
    ],
    [
      "canal não suportado",
      {
        outbound: createOutbound({
          channel: "EMAIL" as CommunicationChannel,
        }),
      },
      "UNSUPPORTED_CHANNEL",
    ],
  ])("cancela quando há %s", (_label, overrides, reason) => {
    expect(service.evaluate(createInput(overrides))).toEqual({
      status: "CANCELLED",
      reason,
    });
  });

  it.each([UserStatus.PENDING, UserStatus.ACTIVE])(
    "retorna READY para usuário %s quando todos os dados são elegíveis",
    (status) => {
      expect(
        service.evaluate(createInput({ user: createUser({ status }) })),
      ).toEqual({ status: "READY" });
    },
  );
});

function createInput(
  overrides: Partial<OutboundNotificationEligibilityInput> = {},
): OutboundNotificationEligibilityInput {
  return {
    outbound: createOutbound(),
    user: createUser(),
    preference: {
      channel: CommunicationChannel.WHATSAPP,
      enabled: true,
    },
    notification: createNotification(),
    ...overrides,
  };
}

function createOutbound(
  overrides: Partial<OutboundNotificationEligibilityInput["outbound"]> = {},
): OutboundNotificationEligibilityInput["outbound"] {
  return {
    status: OutboundNotificationStatus.PENDING,
    channel: CommunicationChannel.WHATSAPP,
    eventType: NotificationType.OPPORTUNITY_CREATED,
    userId: "user-id",
    ...overrides,
  };
}

function createUser(
  overrides: Partial<NonNullable<OutboundNotificationEligibilityInput["user"]>> = {},
): NonNullable<OutboundNotificationEligibilityInput["user"]> {
  return {
    id: "user-id",
    status: UserStatus.ACTIVE,
    deletedAt: null,
    phoneNormalized: "5511999999999",
    phoneVerifiedAt: new Date("2026-08-26T10:00:00.000Z"),
    ...overrides,
  };
}

function createNotification(
  overrides: Partial<
    NonNullable<OutboundNotificationEligibilityInput["notification"]>
  > = {},
): NonNullable<OutboundNotificationEligibilityInput["notification"]> {
  return {
    id: "notification-id",
    userId: "user-id",
    deletedAt: null,
    ...overrides,
  };
}
