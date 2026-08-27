import {
  CommunicationChannel,
  NotificationType,
  OutboundNotificationStatus,
  Prisma,
} from "../../generated/prisma/client";
import { OutboundNotificationsService } from "./outbound-notifications.service";

describe("OutboundNotificationsService", () => {
  const notificationId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  let service: OutboundNotificationsService;
  let transactionMock: {
    $queryRaw: jest.Mock;
    outboundNotification: {
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    service = new OutboundNotificationsService();
    transactionMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      outboundNotification: {
        upsert: jest.fn().mockResolvedValue({ id: "outbound-id" }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  });

  it("cria entrega PENDING com attemptCount zero e preserva eventType", async () => {
    await service.createPending({
      transaction: transactionMock as unknown as Prisma.TransactionClient,
      notificationId,
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
    });

    expect(transactionMock.outboundNotification.upsert).toHaveBeenCalledWith({
      where: {
        notificationId_channel: {
          notificationId,
          channel: CommunicationChannel.WHATSAPP,
        },
      },
      update: {},
      create: {
        notificationId,
        userId,
        channel: CommunicationChannel.WHATSAPP,
        eventType: NotificationType.OPPORTUNITY_CREATED,
        status: OutboundNotificationStatus.PENDING,
        attemptCount: 0,
      },
    });
  });

  it("é idempotente pela chave notificationId e channel", async () => {
    const input = {
      transaction: transactionMock as unknown as Prisma.TransactionClient,
      notificationId,
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
    };

    await service.createPending(input);
    await service.createPending(input);

    expect(transactionMock.outboundNotification.upsert).toHaveBeenCalledTimes(2);
    for (const [call] of transactionMock.outboundNotification.upsert.mock.calls) {
      expect(call.where).toEqual({
        notificationId_channel: {
          notificationId,
          channel: CommunicationChannel.WHATSAPP,
        },
      });
      expect(call.update).toEqual({});
    }
  });

  it("usa somente o transaction client e não inclui dados sensíveis ou payload", async () => {
    await service.createPending({
      transaction: transactionMock as unknown as Prisma.TransactionClient,
      notificationId,
      userId,
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
    });

    const create = transactionMock.outboundNotification.upsert.mock.calls[0][0]
      .create;
    expect(create).not.toHaveProperty("phone");
    expect(create).not.toHaveProperty("email");
    expect(create).not.toHaveProperty("payload");
    expect(create).not.toHaveProperty("message");
    expect(Object.keys(transactionMock)).toEqual([
      "$queryRaw",
      "outboundNotification",
    ]);
  });

  it("seleciona lote PENDING vencido com FOR UPDATE SKIP LOCKED", async () => {
    transactionMock.$queryRaw.mockResolvedValue([{ id: "outbound-id" }]);
    transactionMock.outboundNotification.findMany.mockResolvedValue([]);

    await service.findEligibilityCandidates(
      transactionMock as unknown as Prisma.TransactionClient,
      25,
    );

    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    const sql = query.strings.join(" ");
    expect(sql).toContain('"status" =');
    expect(sql).toContain('"next_attempt_at" IS NULL');
    expect(sql).toContain('"next_attempt_at" <= NOW()');
    expect(sql).toContain('ORDER BY "created_at" ASC, "id" ASC');
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("LIMIT");
    expect(query.values).toContain(OutboundNotificationStatus.PENDING);
    expect(query.values).toContain(25);
  });

  it("carrega somente os campos mínimos e preserva a ordenação", async () => {
    transactionMock.$queryRaw.mockResolvedValue([{ id: "outbound-id" }]);
    transactionMock.outboundNotification.findMany.mockResolvedValue([]);

    await service.findEligibilityCandidates(
      transactionMock as unknown as Prisma.TransactionClient,
      10,
    );

    expect(transactionMock.outboundNotification.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["outbound-id"] } },
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
  });

  it("associa somente a preferência do mesmo evento do outbound", async () => {
    transactionMock.$queryRaw.mockResolvedValue([{ id: "outbound-id" }]);
    transactionMock.outboundNotification.findMany.mockResolvedValue([
      {
        id: "outbound-id",
        userId,
        notificationId,
        channel: CommunicationChannel.WHATSAPP,
        eventType: NotificationType.PROPOSAL_CREATED,
        status: OutboundNotificationStatus.PENDING,
        nextAttemptAt: null,
        user: {
          id: userId,
          status: "ACTIVE",
          deletedAt: null,
          phoneNormalized: "5511999999999",
          phoneVerifiedAt: new Date("2026-08-26T10:00:00.000Z"),
          communicationPreferences: [
            {
              channel: CommunicationChannel.WHATSAPP,
              eventType: NotificationType.OPPORTUNITY_CREATED,
              enabled: true,
            },
            {
              channel: CommunicationChannel.WHATSAPP,
              eventType: NotificationType.PROPOSAL_CREATED,
              enabled: false,
            },
          ],
        },
        notification: { id: notificationId, userId, deletedAt: null },
      },
    ]);

    const [candidate] = await service.findEligibilityCandidates(
      transactionMock as unknown as Prisma.TransactionClient,
      10,
    );

    expect(candidate.preference).toEqual({
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.PROPOSAL_CREATED,
      enabled: false,
    });
  });
});
