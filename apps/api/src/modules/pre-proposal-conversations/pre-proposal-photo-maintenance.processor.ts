import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { PreProposalPhotoMaintenanceService } from "./pre-proposal-photo-maintenance.service";

@Injectable()
export class PreProposalPhotoMaintenanceProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private running = false;
  constructor(private readonly service: PreProposalPhotoMaintenanceService, private readonly scheduler: SchedulerRegistry) {}
  onApplicationBootstrap(): void { this.scheduler.addInterval("pre-proposal-photo-maintenance", setInterval(() => void this.run(), 60_000)); }
  onApplicationShutdown(): void { if (this.scheduler.doesExist("interval", "pre-proposal-photo-maintenance")) this.scheduler.deleteInterval("pre-proposal-photo-maintenance"); }
  async run(): Promise<void> { if (this.running) return; this.running = true; try { await this.service.processBatch(new Date(), 25); } finally { this.running = false; } }
}
