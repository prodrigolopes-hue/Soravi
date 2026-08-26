import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import { OutboundNotificationStatus } from "../../generated/prisma/client";
import { OutboundNotificationEligibilityService } from "./outbound-notification-eligibility.service";
import { OutboundNotificationsService } from "./outbound-notifications.service";

export const OUTBOUND_NOTIFICATION_INTERVAL_MS_DEFAULT = 60_000;
export const OUTBOUND_NOTIFICATION_BATCH_SIZE_DEFAULT = 25;

const SCHEDULER_NAME = "outbound-notification-eligibility";

@Injectable()
export class OutboundNotificationProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboundNotificationProcessor.name);
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundNotificationsService: OutboundNotificationsService,
    private readonly eligibilityService: OutboundNotificationEligibilityService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.intervalMs = this.configService.get<number>(
      "OUTBOUND_NOTIFICATION_INTERVAL_MS",
      OUTBOUND_NOTIFICATION_INTERVAL_MS_DEFAULT,
    );
    this.batchSize = this.configService.get<number>(
      "OUTBOUND_NOTIFICATION_BATCH_SIZE",
      OUTBOUND_NOTIFICATION_BATCH_SIZE_DEFAULT,
    );
  }

  onApplicationBootstrap(): void {
    const interval = setInterval(
      () => void this.processEligibilityBatch(),
      this.intervalMs,
    );

    this.schedulerRegistry.addInterval(SCHEDULER_NAME, interval);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist("interval", SCHEDULER_NAME)) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_NAME);
    }
  }

  async processEligibilityBatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.prisma.$transaction(async (transaction) => {
        const candidates =
          await this.outboundNotificationsService.findEligibilityCandidates(
            transaction,
            this.batchSize,
          );

        for (const candidate of candidates) {
          let result;

          try {
            result = this.eligibilityService.evaluate(candidate);
          } catch {
            this.logger.error(
              `Falha ao avaliar elegibilidade do outbound ${candidate.outbound.id}.`,
            );
            continue;
          }

          if (result.status === "READY") {
            continue;
          }

          await transaction.outboundNotification.updateMany({
            where: {
              id: candidate.outbound.id,
              status: OutboundNotificationStatus.PENDING,
            },
            data: {
              status: OutboundNotificationStatus.CANCELLED,
              lastErrorCode: result.reason,
            },
          });
        }
      });
    } catch {
      this.logger.error("Falha ao processar elegibilidade do outbox.");
    } finally {
      this.isProcessing = false;
    }
  }
}
