import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";

export const AUTH_REFRESH_TOKEN_HISTORY_CLEANUP_INTERVAL_MS =
  24 * 60 * 60 * 1000;

const SCHEDULER_NAME = "auth-refresh-token-history-cleanup";

@Injectable()
export class AuthRefreshTokenHistoryCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(
    AuthRefreshTokenHistoryCleanupService.name,
  );
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    void this.cleanupExpiredHistory();

    const interval = setInterval(
      () => void this.cleanupExpiredHistory(),
      AUTH_REFRESH_TOKEN_HISTORY_CLEANUP_INTERVAL_MS,
    );

    this.schedulerRegistry.addInterval(SCHEDULER_NAME, interval);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist("interval", SCHEDULER_NAME)) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_NAME);
    }
  }

  async cleanupExpiredHistory(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = new Date();

      const result =
        await this.prisma.authRefreshTokenHistory.deleteMany({
          where: {
            expiresAt: {
              lte: now,
            },
          },
        });

      if (result.count > 0) {
        this.logger.log(
          `Removidos ${result.count} históricos expirados de refresh token.`,
        );
      }
    } catch {
      this.logger.error(
        "Falha ao limpar histórico expirado de refresh token.",
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
