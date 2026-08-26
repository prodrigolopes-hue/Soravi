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
    outboundNotification: {
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    service = new OutboundNotificationsService();
    transactionMock = {
      outboundNotification: {
        upsert: jest.fn().mockResolvedValue({ id: "outbound-id" }),
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
    expect(Object.keys(transactionMock)).toEqual(["outboundNotification"]);
  });
});
