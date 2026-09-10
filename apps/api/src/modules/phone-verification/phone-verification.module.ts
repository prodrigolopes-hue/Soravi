import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { MetaWhatsAppPhoneVerificationDeliveryAdapter } from "./meta-whatsapp-phone-verification-delivery.adapter";
import { PhoneVerificationCodeService } from "./phone-verification-code.service";
import {
  PHONE_VERIFICATION_DELIVERY_PORT,
  PhoneVerificationDeliveryPort,
} from "./phone-verification-delivery.port";
import { PhoneVerificationController } from "./phone-verification.controller";
import { PhoneVerificationService } from "./phone-verification.service";
import { UnavailablePhoneVerificationDeliveryService } from "./unavailable-phone-verification-delivery.service";

export function createPhoneVerificationDeliveryPort(
  configService: ConfigService,
): PhoneVerificationDeliveryPort {
  const provider = configService.get<string>(
    "PHONE_VERIFICATION_DELIVERY_PROVIDER",
    "unavailable",
  );

  if (provider === "meta") {
    return new MetaWhatsAppPhoneVerificationDeliveryAdapter(configService);
  }

  if (provider === "unavailable") {
    return new UnavailablePhoneVerificationDeliveryService();
  }

  throw new Error("Provider de entrega de OTP inválido.");
}

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
  ],
  controllers: [PhoneVerificationController],
  providers: [
    PhoneVerificationCodeService,
    {
      provide: PHONE_VERIFICATION_DELIVERY_PORT,
      inject: [ConfigService],
      useFactory: createPhoneVerificationDeliveryPort,
    },
    PhoneVerificationService,
  ],
  exports: [PhoneVerificationCodeService, PhoneVerificationService],
})
export class PhoneVerificationModule {}
