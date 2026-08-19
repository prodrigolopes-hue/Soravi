import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { StorageModule } from "../../storage/storage.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { OpportunitiesController } from "./opportunities.controller";
import { OpportunitiesService } from "./opportunities.service";
import { ServiceOpportunityDistributionProcessor } from "./service-opportunity-distribution.processor";
import { ServiceOpportunityDistributionService } from "./service-opportunity-distribution.service";
import { ServiceRequestsController } from "./service-requests.controller";
import { ServiceRequestsService } from "./service-requests.service";

@Module({
  imports: [PrismaModule, StorageModule, AccessTokenModule],
  controllers: [OpportunitiesController, ServiceRequestsController],
  providers: [
    OpportunitiesService,
    ServiceOpportunityDistributionProcessor,
    ServiceOpportunityDistributionService,
    ServiceRequestsService,
  ],
  exports: [ServiceOpportunityDistributionService],
})
export class ServiceRequestsModule {}
