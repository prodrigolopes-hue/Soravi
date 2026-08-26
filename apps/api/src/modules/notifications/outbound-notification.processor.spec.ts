import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import {
  CommunicationChannel,
  NotificationType,
  OutboundNotificationStatus,
  UserStatus,
} from "../../generated/prisma/client";
import { OutboundNotificationEligibilityService } from "./outbound-notification-eligibility.service";
import {
  OUTBOUND_NOTIFICATION_BATCH_SIZE_DEFAULT,
  OUTBOUND_NOTIFICATION_INTERVAL_MS_DEFAULT,
  OutboundNotificationProcessor,
} from "./outbound-notification.processor";
import {
  OutboundNotificationEligibilityCandidate,
  OutboundNotificationsService,
} from "./outbound-notifications.service";

describe("OutboundNotificationProcessor", () => {
  let processor: OutboundNotificationProcessor;
  let transactionMock: {
    outboundNotification: { updateMany: jest.Mock };
  };
  let prismaMock: { $transaction: jest.Mock };
  let outboundServiceMock: { findEligibilityCandidates: jest.Mock };
  let eligibilityServiceMock: { evaluate: jest.Mock };
  let configServiceMock: { get: jest.Mock };
  let schedulerRegistryMock: {
    addInterval: jest.Mock;
    doesExist: jest.Mock;
    deleteInterval: jest.Mock;
  };
  let setIntervalSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    transactionMock = {
      outboundNotification: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
          callback(transactionMock),
      ),
    };
    outboundServiceMock = {
      findEligibilityCandidates: jest.fn().mockResolvedValue([]),
    };
    eligibilityServiceMock = {
      evaluate: jest.fn().mockReturnValue({ status: "READY" }),
    };
    configServiceMock = {
      get: jest.fn((_key: string, defaultValue: number) => defaultValue),
    };
    schedulerRegistryMock = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockReturnValue({} as NodeJS.Timeout);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    processor = createProcessor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("cancela item inelegível com reason sanitizado", async () => {
    outboundServiceMock.findEligibilityCandidates.mockResolvedValue([
      createCandidate(),
    ]);
    eligibilityServiceMock.evaluate.mockReturnValue({
      status: "CANCELLED",
      reason: "PREFERENCE_DISABLED",
    });

    await processor.processEligibilityBatch();

    expect(transactionMock.outboundNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: "outbound-id",
        status: OutboundNotificationStatus.PENDING,
      },
      data: {
        status: OutboundNotificationStatus.CANCELLED,
        lastErrorCode: "PREFERENCE_DISABLED",
      },
    });
  });

  it("mantém READY em PENDING sem alterar tentativa ou agendamento", async () => {
    outboundServiceMock.findEligibilityCandidates.mockResolvedValue([
      createCandidate(),
    ]);

    await processor.processEligibilityBatch();

    expect(eligibilityServiceMock.evaluate).toHaveBeenCalledWith(createCandidate());
    expect(transactionMock.outboundNotification.updateMany).not.toHaveBeenCalled();
  });

  it("usa transaction client e batch padrão", async () => {
    await processor.processEligibilityBatch();

    expect(outboundServiceMock.findEligibilityCandidates).toHaveBeenCalledWith(
      transactionMock,
      OUTBOUND_NOTIFICATION_BATCH_SIZE_DEFAULT,
    );
  });

  it("continua o lote após falha segura de avaliação", async () => {
    outboundServiceMock.findEligibilityCandidates.mockResolvedValue([
      createCandidate({ id: "first-id" }),
      createCandidate({ id: "second-id" }),
    ]);
    eligibilityServiceMock.evaluate
      .mockImplementationOnce(() => {
        throw new Error("evaluation failed");
      })
      .mockReturnValueOnce({
        status: "CANCELLED",
        reason: "PHONE_MISSING",
      });

    await processor.processEligibilityBatch();

    expect(eligibilityServiceMock.evaluate).toHaveBeenCalledTimes(2);
    expect(transactionMock.outboundNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "second-id" }) }),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha ao avaliar elegibilidade do outbound first-id.",
    );
  });

  it("ignora execução sobreposta e libera a trava em finally", async () => {
    let resolveCandidates:
      | ((value: OutboundNotificationEligibilityCandidate[]) => void)
      | undefined;
    outboundServiceMock.findEligibilityCandidates
      .mockReturnValueOnce(
        new Promise<OutboundNotificationEligibilityCandidate[]>((resolve) => {
          resolveCandidates = resolve;
        }),
      )
      .mockResolvedValueOnce([]);

    const firstRun = processor.processEligibilityBatch();
    await processor.processEligibilityBatch();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    resolveCandidates?.([]);
    await firstRun;
    await processor.processEligibilityBatch();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("libera a trava local após falha global", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockImplementationOnce(
        (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
          callback(transactionMock),
      );

    await processor.processEligibilityBatch();
    await processor.processEligibilityBatch();

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha ao processar elegibilidade do outbox.",
    );
  });

  it("registra intervalo padrão e remove no shutdown", () => {
    processor.onApplicationBootstrap();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      OUTBOUND_NOTIFICATION_INTERVAL_MS_DEFAULT,
    );
    expect(schedulerRegistryMock.addInterval).toHaveBeenCalledWith(
      "outbound-notification-eligibility",
      expect.anything(),
    );

    processor.onApplicationShutdown();
    expect(schedulerRegistryMock.doesExist).toHaveBeenCalledWith(
      "interval",
      "outbound-notification-eligibility",
    );
    expect(schedulerRegistryMock.deleteInterval).toHaveBeenCalledWith(
      "outbound-notification-eligibility",
    );
  });

  it("usa intervalo e batch configurados", async () => {
    configServiceMock.get.mockImplementation(
      (key: string, defaultValue: number) =>
        ({
          OUTBOUND_NOTIFICATION_INTERVAL_MS: 5_000,
          OUTBOUND_NOTIFICATION_BATCH_SIZE: 12,
        })[key] ?? defaultValue,
    );
    processor = createProcessor();

    processor.onApplicationBootstrap();
    await processor.processEligibilityBatch();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(outboundServiceMock.findEligibilityCandidates).toHaveBeenCalledWith(
      transactionMock,
      12,
    );
  });

  function createProcessor(): OutboundNotificationProcessor {
    return new OutboundNotificationProcessor(
      prismaMock as unknown as PrismaService,
      outboundServiceMock as unknown as OutboundNotificationsService,
      eligibilityServiceMock as unknown as OutboundNotificationEligibilityService,
      configServiceMock as unknown as ConfigService,
      schedulerRegistryMock as unknown as SchedulerRegistry,
    );
  }
});

function createCandidate(
  outboundOverrides: Partial<
    OutboundNotificationEligibilityCandidate["outbound"]
  > = {},
): OutboundNotificationEligibilityCandidate {
  return {
    outbound: {
      id: "outbound-id",
      userId: "user-id",
      notificationId: "notification-id",
      channel: CommunicationChannel.WHATSAPP,
      eventType: NotificationType.OPPORTUNITY_CREATED,
      status: OutboundNotificationStatus.PENDING,
      nextAttemptAt: null,
      ...outboundOverrides,
    },
    user: {
      id: "user-id",
      status: UserStatus.ACTIVE,
      deletedAt: null,
      phoneNormalized: "5511999999999",
      phoneVerifiedAt: new Date("2026-08-26T10:00:00.000Z"),
    },
    preference: {
      channel: CommunicationChannel.WHATSAPP,
      enabled: true,
    },
    notification: {
      id: "notification-id",
      userId: "user-id",
      deletedAt: null,
    },
  };
}
