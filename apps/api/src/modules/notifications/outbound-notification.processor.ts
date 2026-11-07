import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import {
  NotificationType,
  OutboundNotificationStatus,
  Prisma,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { OutboundNotificationEligibilityService } from "./outbound-notification-eligibility.service";
import { OutboundNotificationsService } from "./outbound-notifications.service";
import {
  WHATSAPP_NOTIFICATION_DELIVERY_PORT,
  WhatsAppNotificationDeliveryPort,
} from "./whatsapp-notification-delivery.port";

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
    @Inject(WHATSAPP_NOTIFICATION_DELIVERY_PORT)
    private readonly whatsappDelivery: WhatsAppNotificationDeliveryPort,
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
    if (this.configService.get<string>("OUTBOUND_WHATSAPP_DELIVERY_ENABLED", "false") !== "true") {
      return;
    }
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

          if (result.status !== "READY") {
            await transaction.outboundNotification.updateMany({
              where: { id: candidate.outbound.id, status: OutboundNotificationStatus.PENDING },
              data: { status: OutboundNotificationStatus.CANCELLED, lastErrorCode: result.reason },
            });
            continue;
          }

          const pilotReason = this.pilotBlockReason(candidate);
          if (pilotReason) {
            await transaction.outboundNotification.updateMany({
              where: { id: candidate.outbound.id, status: OutboundNotificationStatus.PENDING },
              data: { status: OutboundNotificationStatus.CANCELLED, lastErrorCode: pilotReason },
            });
            continue;
          }

          const claimed = await transaction.outboundNotification.updateMany({
            where: { id: candidate.outbound.id, status: OutboundNotificationStatus.PENDING },
            data: { status: OutboundNotificationStatus.PROCESSING },
          });
          if (claimed.count !== 1) continue;

          if (!(await this.isStillAvailable(transaction, candidate))) {
            await transaction.outboundNotification.update({
              where: { id: candidate.outbound.id },
              data: { status: OutboundNotificationStatus.CANCELLED, lastErrorCode: "RESOURCE_UNAVAILABLE" },
            });
            continue;
          }

          try {
            const accepted = await this.whatsappDelivery.send({
              phoneNormalized: candidate.user!.phoneNormalized!,
              eventType: candidate.outbound.eventType as typeof NotificationType.OPPORTUNITY_CREATED | typeof NotificationType.PROPOSAL_CREATED,
              loginUrl: `${this.configService.getOrThrow<string>("FRONTEND_PUBLIC_URL").replace(/\/$/u, "")}/login`,
            });
            await transaction.outboundNotification.update({
              where: { id: candidate.outbound.id },
              data: { status: OutboundNotificationStatus.SENT, sentAt: new Date(), providerMessageId: accepted.providerMessageId },
            });
          } catch {
            await transaction.outboundNotification.update({
              where: { id: candidate.outbound.id },
              data: { status: OutboundNotificationStatus.FAILED, lastErrorCode: "PROVIDER_UNCERTAIN" },
            });
          }
          continue;
        }
      });
    } catch {
      this.logger.error("Falha ao processar elegibilidade do outbox.");
    } finally {
      this.isProcessing = false;
    }
  }

  private pilotBlockReason(candidate: import("./outbound-notifications.service").OutboundNotificationEligibilityCandidate): string | undefined {
    const cutoff = new Date(this.configService.getOrThrow<string>("OUTBOUND_WHATSAPP_CUTOFF_AT"));
    if (candidate.outbound.createdAt < cutoff) return "PILOT_BEFORE_CUTOFF";
    const allowed = this.configService.getOrThrow<string>("OUTBOUND_WHATSAPP_TEST_NUMBERS")
      .split(",").map((value) => value.trim()).filter(Boolean);
    if (!candidate.user || !allowed.includes(candidate.user.phoneNormalized ?? "")) return "PILOT_RECIPIENT_NOT_ALLOWED";
    return undefined;
  }

  private async isStillAvailable(
    transaction: Prisma.TransactionClient,
    candidate: import("./outbound-notifications.service").OutboundNotificationEligibilityCandidate,
  ): Promise<boolean> {
    if (!candidate.notification || !candidate.user) return false;
    const user = await transaction.user.findUnique({
      where: { id: candidate.outbound.userId },
      select: { phoneVerifiedAt: true, phoneNormalized: true, communicationPreferences: { where: { channel: candidate.outbound.channel, eventType: candidate.outbound.eventType }, select: { enabled: true } } },
    });
    if (!user?.phoneNormalized || !user.phoneVerifiedAt || !user.communicationPreferences[0]?.enabled) return false;
    if (candidate.outbound.eventType === NotificationType.OPPORTUNITY_CREATED) {
      return Boolean(await transaction.serviceOpportunity.findFirst({
        where: { id: candidate.notification.resourceId, professionalProfile: { userId: candidate.outbound.userId }, serviceRequest: { deletedAt: null, status: { in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.RECEIVING_PROPOSALS] } } },
        select: { id: true },
      }));
    }
    return Boolean(await transaction.proposal.findFirst({
      where: { id: candidate.notification.resourceId, isVisible: true, serviceRequest: { customerProfile: { userId: candidate.outbound.userId }, deletedAt: null } },
      select: { id: true },
    }));
  }
}
