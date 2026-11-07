import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { CommunicationPreferencesService } from "./communication-preferences.service";
import { OutboundNotificationEligibilityService } from "./outbound-notification-eligibility.service";
import { OutboundNotificationProcessor } from "./outbound-notification.processor";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { OutboundNotificationsService } from "./outbound-notifications.service";
import { MetaWhatsAppNotificationDeliveryAdapter } from "./meta-whatsapp-notification-delivery.adapter";
import { UnavailableWhatsAppNotificationDeliveryService } from "./unavailable-whatsapp-notification-delivery.service";
import { WHATSAPP_NOTIFICATION_DELIVERY_PORT } from "./whatsapp-notification-delivery.port";

@Module({
  imports: [PrismaModule, AccessTokenModule],
  controllers: [NotificationsController],
  providers: [
    CommunicationPreferencesService,
    NotificationsService,
    OutboundNotificationEligibilityService,
    OutboundNotificationProcessor,
    OutboundNotificationsService,
    MetaWhatsAppNotificationDeliveryAdapter,
    UnavailableWhatsAppNotificationDeliveryService,
    {
      provide: WHATSAPP_NOTIFICATION_DELIVERY_PORT,
      inject: [ConfigService, MetaWhatsAppNotificationDeliveryAdapter, UnavailableWhatsAppNotificationDeliveryService],
      useFactory: (config: ConfigService, meta: MetaWhatsAppNotificationDeliveryAdapter, unavailable: UnavailableWhatsAppNotificationDeliveryService) =>
        config.get<string>("OUTBOUND_WHATSAPP_DELIVERY_PROVIDER", "unavailable") === "meta" ? meta : unavailable,
    },
  ],
  exports: [CommunicationPreferencesService, OutboundNotificationsService],
})
export class NotificationsModule {}
