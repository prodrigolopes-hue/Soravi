import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { StorageModule } from "../../storage/storage.module";
import { PreProposalConversationsController } from "./pre-proposal-conversations.controller";
import { PreProposalConversationsService } from "./pre-proposal-conversations.service";
import { PreProposalPhotoMaintenanceService } from "./pre-proposal-photo-maintenance.service";
import { PreProposalPhotoMaintenanceProcessor } from "./pre-proposal-photo-maintenance.processor";

@Module({
  imports: [PrismaModule, AccessTokenModule, StorageModule],
  controllers: [PreProposalConversationsController],
  providers: [PreProposalConversationsService, PreProposalPhotoMaintenanceService, PreProposalPhotoMaintenanceProcessor],
})
export class PreProposalConversationsModule {}
