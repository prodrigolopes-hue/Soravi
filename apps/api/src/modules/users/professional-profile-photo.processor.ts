import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";

export const PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_INTERVAL_MS = 60_000;
export const PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE = 25;

const SCHEDULER_NAME = "professional-profile-photo-maintenance";

@Injectable()
export class ProfessionalProfilePhotoProcessor
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ProfessionalProfilePhotoProcessor.name);
  private isProcessing = false;

  constructor(
    private readonly professionalProfilePhotoService: ProfessionalProfilePhotoService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const interval = setInterval(
      () => void this.processBatches(),
      PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_INTERVAL_MS,
    );

    this.schedulerRegistry.addInterval(SCHEDULER_NAME, interval);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist("interval", SCHEDULER_NAME)) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_NAME);
    }
  }

  async processBatches(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      try {
        await this.professionalProfilePhotoService.processCleanupBatch(
          new Date(),
          PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE,
        );
      } catch {
        this.logger.error(
          "Falha sanitizada no processamento de limpeza de fotos profissionais.",
        );
      }

      try {
        await this.professionalProfilePhotoService.processCandidateReconciliationBatch(
          new Date(),
          PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE,
        );
      } catch {
        this.logger.error(
          "Falha sanitizada na reconciliação de fotos profissionais.",
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
