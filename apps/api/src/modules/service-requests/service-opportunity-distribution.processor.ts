import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import { ServiceRequestStatus } from "../../generated/prisma/client";
import { ServiceOpportunityDistributionService } from "./service-opportunity-distribution.service";

export const OPPORTUNITY_DISTRIBUTION_INTERVAL_MS_DEFAULT = 60_000;
export const OPPORTUNITY_DISTRIBUTION_BATCH_SIZE_DEFAULT = 50;

const SCHEDULER_NAME = "service-opportunity-distribution";

@Injectable()
export class ServiceOpportunityDistributionProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    ServiceOpportunityDistributionProcessor.name,
  );
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly distributionService: ServiceOpportunityDistributionService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.intervalMs = this.configService.get<number>(
      "OPPORTUNITY_DISTRIBUTION_INTERVAL_MS",
      OPPORTUNITY_DISTRIBUTION_INTERVAL_MS_DEFAULT,
    );
    this.batchSize = this.configService.get<number>(
      "OPPORTUNITY_DISTRIBUTION_BATCH_SIZE",
      OPPORTUNITY_DISTRIBUTION_BATCH_SIZE_DEFAULT,
    );
  }

  onApplicationBootstrap(): void {
    void this.processEligibleServiceRequests();

    const interval = setInterval(
      () => void this.processEligibleServiceRequests(),
      this.intervalMs,
    );

    this.schedulerRegistry.addInterval(SCHEDULER_NAME, interval);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist("interval", SCHEDULER_NAME)) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_NAME);
    }
  }

  async processEligibleServiceRequests(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const serviceRequests = await this.prisma.serviceRequest.findMany({
        where: {
          status: ServiceRequestStatus.OPEN,
          publishedAt: { not: null },
          opportunitiesDispatchedAt: null,
          deletedAt: null,
        },
        orderBy: { publishedAt: "asc" },
        take: this.batchSize,
        select: { id: true },
      });

      for (const serviceRequest of serviceRequests) {
        try {
          await this.distributionService.distribute(serviceRequest.id);
        } catch (error: unknown) {
          this.logger.error(
            `Falha ao distribuir oportunidades para a solicitação ${serviceRequest.id}.`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        "Falha ao buscar solicitações elegíveis para distribuição.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
