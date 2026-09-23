import "reflect-metadata";

import {
  NotificationType,
  ReviewReminderType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ReviewPublicationProcessor } from "./review-publication.processor";

const now = new Date("2026-09-23T12:00:00.000Z");
const dayMs = 24 * 60 * 60 * 1000;

function reminderContract(daysElapsed: number, input?: {
  review?: { id: string } | null;
  customerReview?: { id: string } | null;
}) {
  return {
    id: "contract-id",
    completedAt: new Date(now.getTime() - daysElapsed * dayMs),
    customerProfile: { userId: "customer-user" },
    professionalProfile: { userId: "professional-user" },
    review: input?.review ?? null,
    customerReview: input?.customerReview ?? null,
  };
}

function expiredContract(input: {
  review?: { id: string; publishedAt: Date | null } | null;
  customerReview?: { id: string; publishedAt: Date | null } | null;
}) {
  return {
    id: "contract-id",
    customerProfileId: "customer-profile-id",
    professionalProfileId: "professional-profile-id",
    review: input.review ?? null,
    customerReview: input.customerReview ?? null,
  };
}

describe("ReviewPublicationProcessor", () => {
  const transaction = {
    reviewReminder: { createMany: jest.fn() },
    notification: { createMany: jest.fn() },
    review: { updateMany: jest.fn(), aggregate: jest.fn() },
    customerReview: { updateMany: jest.fn(), aggregate: jest.fn() },
    professionalProfile: { update: jest.fn() },
    customerProfile: { update: jest.fn() },
  };
  const prisma = {
    contract: { findMany: jest.fn() },
    $transaction: jest.fn(
      (callback: (value: typeof transaction) => unknown) => callback(transaction),
    ),
  };
  const schedulerRegistry = {
    addInterval: jest.fn(),
    doesExist: jest.fn(),
    deleteInterval: jest.fn(),
  };
  const configService = { get: jest.fn().mockReturnValue(60_000) };
  const processor = new ReviewPublicationProcessor(
    configService as never,
    schedulerRegistry as never,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.clearAllMocks();
    transaction.reviewReminder.createMany.mockResolvedValue({ count: 1 });
    transaction.notification.createMany.mockResolvedValue({ count: 1 });
    transaction.review.updateMany.mockResolvedValue({ count: 1 });
    transaction.customerReview.updateMany.mockResolvedValue({ count: 1 });
    transaction.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: 2,
    });
    transaction.customerReview.aggregate.mockResolvedValue({
      _avg: { rating: 3.5 },
      _count: 3,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [1, ReviewReminderType.D1, NotificationType.REVIEW_REMINDER_D1],
    [4, ReviewReminderType.D4, NotificationType.REVIEW_REMINDER_D4],
    [6, ReviewReminderType.D6, NotificationType.REVIEW_REMINDER_D6],
  ])("cria o lembrete correto em D+%i", async (days, reminderType, notificationType) => {
    prisma.contract.findMany
      .mockResolvedValueOnce([reminderContract(days)])
      .mockResolvedValueOnce([]);

    await processor.processReviews();

    expect(transaction.reviewReminder.createMany).toHaveBeenCalledTimes(2);
    expect(transaction.reviewReminder.createMany).toHaveBeenCalledWith({
      data: [{ contractId: "contract-id", userId: "customer-user", reminderType }],
      skipDuplicates: true,
    });
    expect(transaction.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          userId: "customer-user",
          type: notificationType,
        })],
      }),
    );
  });

  it("em D+5 cria somente o lembrete D4", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([reminderContract(5)])
      .mockResolvedValueOnce([]);

    await processor.processReviews();

    expect(transaction.reviewReminder.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ reminderType: ReviewReminderType.D4 })],
      }),
    );
    expect(transaction.reviewReminder.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ reminderType: ReviewReminderType.D1 })],
      }),
    );
  });

  it("não lembra a parte que já avaliou", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([reminderContract(1, { review: { id: "review-id" } })])
      .mockResolvedValueOnce([]);

    await processor.processReviews();

    expect(transaction.reviewReminder.createMany).toHaveBeenCalledTimes(1);
    expect(transaction.reviewReminder.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ userId: "professional-user" })],
      }),
    );
  });

  it("não cria lembretes após D+7", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([reminderContract(7)])
      .mockResolvedValueOnce([]);

    await processor.processReviews();

    expect(transaction.reviewReminder.createMany).not.toHaveBeenCalled();
  });

  it("não duplica um lembrete cuja reserva já existe", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([reminderContract(1, { customerReview: { id: "customer-review-id" } })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([reminderContract(1, { customerReview: { id: "customer-review-id" } })])
      .mockResolvedValueOnce([]);
    transaction.reviewReminder.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await processor.processReviews();
    await processor.processReviews();

    expect(transaction.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it("em D+7 publica a review pendente e recalcula só avaliações publicadas", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([expiredContract({ review: { id: "review-id", publishedAt: null } })]);

    await processor.processReviews();

    expect(transaction.review.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "review-id", publishedAt: null } }),
    );
    expect(transaction.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          professionalProfileId: "professional-profile-id",
          publishedAt: { not: null },
        },
      }),
    );
    expect(transaction.professionalProfile.update).toHaveBeenCalled();
    expect(transaction.customerProfile.update).not.toHaveBeenCalled();
  });

  it("em D+7 publica a customerReview pendente e recalcula só avaliações publicadas", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([expiredContract({ customerReview: { id: "customer-review-id", publishedAt: null } })]);

    await processor.processReviews();

    expect(transaction.customerReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "customer-review-id", publishedAt: null } }),
    );
    expect(transaction.customerReview.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerProfileId: "customer-profile-id",
          publishedAt: { not: null },
        },
      }),
    );
    expect(transaction.customerProfile.update).toHaveBeenCalled();
    expect(transaction.professionalProfile.update).not.toHaveBeenCalled();
  });

  it("não republica nem recalcula avaliações já publicadas", async () => {
    prisma.contract.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await processor.processReviews();

    expect(transaction.review.updateMany).not.toHaveBeenCalled();
    expect(transaction.customerReview.updateMany).not.toHaveBeenCalled();
    expect(transaction.review.aggregate).not.toHaveBeenCalled();
    expect(transaction.customerReview.aggregate).not.toHaveBeenCalled();
  });
});
