import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import {
  ContractStatus,
  NotificationType,
  Prisma,
  ReviewReminderType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";

export const REVIEW_PUBLICATION_INTERVAL_MS_DEFAULT = 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_WINDOW_DAYS = 7;
const SCHEDULER_NAME = "review-publication";

type ReminderDefinition = {
  reminderType: ReviewReminderType;
  notificationType: NotificationType;
  title: string;
  message: string;
};

const REMINDERS: Record<
  ReviewReminderType,
  ReminderDefinition
> = {
  [ReviewReminderType.D1]: {
    reminderType: ReviewReminderType.D1,
    notificationType:
      NotificationType.REVIEW_REMINDER_D1,
    title: "Avalie o serviço",
    message:
      "Como foi o serviço? Sua avaliação ajuda a manter a Soravi mais confiável para todos.",
  },
  [ReviewReminderType.D4]: {
    reminderType: ReviewReminderType.D4,
    notificationType:
      NotificationType.REVIEW_REMINDER_D4,
    title: "Sua avaliação é importante",
    message:
      "Você ainda pode avaliar este serviço. Seu feedback ajuda a comunidade da Soravi.",
  },
  [ReviewReminderType.D6]: {
    reminderType: ReviewReminderType.D6,
    notificationType:
      NotificationType.REVIEW_REMINDER_D6,
    title: "Último dia para avaliar se aproxima",
    message:
      "O prazo para avaliar este serviço termina amanhã.",
  },
};

@Injectable()
export class ReviewPublicationProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly intervalMs: number;
  private isProcessing = false;

  constructor(
    configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
  ) {
    this.intervalMs = configService.get<number>(
      "REVIEW_PUBLICATION_INTERVAL_MS",
      REVIEW_PUBLICATION_INTERVAL_MS_DEFAULT,
    );
  }

  onApplicationBootstrap(): void {
    void this.processReviews();

    this.schedulerRegistry.addInterval(
      SCHEDULER_NAME,
      setInterval(
        () => void this.processReviews(),
        this.intervalMs,
      ),
    );
  }

  onApplicationShutdown(): void {
    if (
      this.schedulerRegistry.doesExist(
        "interval",
        SCHEDULER_NAME,
      )
    ) {
      this.schedulerRegistry.deleteInterval(
        SCHEDULER_NAME,
      );
    }
  }

  async processReviews(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.processReviewReminders();
      await this.publishExpiredReviews();
    } finally {
      this.isProcessing = false;
    }
  }

  private async processReviewReminders(): Promise<void> {
    const now = new Date();

    const reviewWindowDeadline = new Date(
      now.getTime() - REVIEW_WINDOW_DAYS * DAY_MS,
    );

    const firstReminderDeadline = new Date(
      now.getTime() - DAY_MS,
    );

    const contracts =
      await this.prisma.contract.findMany({
        where: {
          status: ContractStatus.COMPLETED,
          completedAt: {
            not: null,
            gt: reviewWindowDeadline,
            lte: firstReminderDeadline,
          },
        },
        select: {
          id: true,
          completedAt: true,

          customerProfile: {
            select: {
              userId: true,
            },
          },

          professionalProfile: {
            select: {
              userId: true,
            },
          },

          review: {
            select: {
              id: true,
            },
          },

          customerReview: {
            select: {
              id: true,
            },
          },
        },
      });

    for (const contract of contracts) {
      if (!contract.completedAt) {
        continue;
      }

      const reminder = this.getCurrentReminder(
        contract.completedAt,
        now,
      );

      if (!reminder) {
        continue;
      }

      // Cliente ainda não avaliou o profissional.
      if (!contract.review) {
        await this.createReminderNotification({
          contractId: contract.id,
          userId: contract.customerProfile.userId,
          reminder,
        });
      }

      // Profissional ainda não avaliou o cliente.
      if (!contract.customerReview) {
        await this.createReminderNotification({
          contractId: contract.id,
          userId:
            contract.professionalProfile.userId,
          reminder,
        });
      }
    }
  }

  private getCurrentReminder(
    completedAt: Date,
    now: Date,
  ): ReminderDefinition | null {
    const elapsedMs =
      now.getTime() - completedAt.getTime();

    if (elapsedMs >= REVIEW_WINDOW_DAYS * DAY_MS) {
      return null;
    }

    if (elapsedMs >= 6 * DAY_MS) {
      return REMINDERS[ReviewReminderType.D6];
    }

    if (elapsedMs >= 4 * DAY_MS) {
      return REMINDERS[ReviewReminderType.D4];
    }

    if (elapsedMs >= DAY_MS) {
      return REMINDERS[ReviewReminderType.D1];
    }

    return null;
  }

  private async createReminderNotification(input: {
    contractId: string;
    userId: string;
    reminder: ReminderDefinition;
  }): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const reservation =
          await transaction.reviewReminder.createMany({
            data: [
              {
                contractId: input.contractId,
                userId: input.userId,
                reminderType:
                  input.reminder.reminderType,
              },
            ],
            skipDuplicates: true,
          });

        if (reservation.count === 0) {
          return;
        }

        await transaction.notification.createMany({
          data: [
            {
              userId: input.userId,
              type: input.reminder.notificationType,
              title: input.reminder.title,
              message: input.reminder.message,
              resourceType: "CONTRACT",
              resourceId: input.contractId,
            },
          ],
          skipDuplicates: true,
        });
      },
    );
  }

  private async publishExpiredReviews(): Promise<void> {
    const reviewDeadline = new Date(
      Date.now() - REVIEW_WINDOW_DAYS * DAY_MS,
    );

    const expiredContracts =
      await this.prisma.contract.findMany({
        where: {
          status: ContractStatus.COMPLETED,
          completedAt: {
            not: null,
            lte: reviewDeadline,
          },
          OR: [
            {
              review: {
                is: {
                  publishedAt: null,
                },
              },
            },
            {
              customerReview: {
                is: {
                  publishedAt: null,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          customerProfileId: true,
          professionalProfileId: true,

          review: {
            select: {
              id: true,
              publishedAt: true,
            },
          },

          customerReview: {
            select: {
              id: true,
              publishedAt: true,
            },
          },
        },
      });

    for (const contract of expiredContracts) {
      const publishedAt = new Date();

      await this.prisma.$transaction(
        async (transaction) => {
          let professionalReviewPublished = false;
          let customerReviewPublished = false;

          if (
            contract.review &&
            contract.review.publishedAt === null
          ) {
            const result =
              await transaction.review.updateMany({
                where: {
                  id: contract.review.id,
                  publishedAt: null,
                },
                data: {
                  publishedAt,
                },
              });

            professionalReviewPublished =
              result.count > 0;
          }

          if (
            contract.customerReview &&
            contract.customerReview.publishedAt ===
            null
          ) {
            const result =
              await transaction.customerReview.updateMany(
                {
                  where: {
                    id: contract.customerReview.id,
                    publishedAt: null,
                  },
                  data: {
                    publishedAt,
                  },
                },
              );

            customerReviewPublished =
              result.count > 0;
          }

          if (professionalReviewPublished) {
            const professionalReputation =
              await transaction.review.aggregate({
                where: {
                  professionalProfileId:
                    contract.professionalProfileId,
                  publishedAt: {
                    not: null,
                  },
                },
                _avg: {
                  rating: true,
                },
                _count: true,
              });

            await transaction.professionalProfile.update(
              {
                where: {
                  id: contract.professionalProfileId,
                },
                data: {
                  averageRating: new Prisma.Decimal(
                    professionalReputation._avg
                      .rating ?? 0,
                  ),
                  reviewCount:
                    professionalReputation._count,
                },
              },
            );
          }

          if (customerReviewPublished) {
            const customerReputation =
              await transaction.customerReview.aggregate(
                {
                  where: {
                    customerProfileId:
                      contract.customerProfileId,
                    publishedAt: {
                      not: null,
                    },
                  },
                  _avg: {
                    rating: true,
                  },
                  _count: true,
                },
              );

            await transaction.customerProfile.update({
              where: {
                id: contract.customerProfileId,
              },
              data: {
                averageRating: new Prisma.Decimal(
                  customerReputation._avg.rating ?? 0,
                ),
                reviewCount:
                  customerReputation._count,
              },
            });
          }
        },
      );
    }
  }
}