import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { CommunicationPreferencesService } from "./communication-preferences.service";
import { OutboundNotificationEligibilityService } from "./outbound-notification-eligibility.service";
import { OutboundNotificationProcessor } from "./outbound-notification.processor";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { OutboundNotificationsService } from "./outbound-notifications.service";

@Module({
  imports: [PrismaModule, AccessTokenModule],
  controllers: [NotificationsController],
  providers: [
    CommunicationPreferencesService,
    NotificationsService,
    OutboundNotificationEligibilityService,
    OutboundNotificationProcessor,
    OutboundNotificationsService,
  ],
  exports: [CommunicationPreferencesService, OutboundNotificationsService],
})
export class NotificationsModule {}
