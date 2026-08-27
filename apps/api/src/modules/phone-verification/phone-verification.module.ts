import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { PhoneVerificationCodeService } from "./phone-verification-code.service";
import { PHONE_VERIFICATION_DELIVERY_PORT } from "./phone-verification-delivery.port";
import { PhoneVerificationController } from "./phone-verification.controller";
import { PhoneVerificationService } from "./phone-verification.service";
import { UnavailablePhoneVerificationDeliveryService } from "./unavailable-phone-verification-delivery.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
    ThrottlerModule.forRoot([{ ttl: 600_000, limit: 10 }]),
  ],
  controllers: [PhoneVerificationController],
  providers: [
    PhoneVerificationCodeService,
    UnavailablePhoneVerificationDeliveryService,
    {
      provide: PHONE_VERIFICATION_DELIVERY_PORT,
      useExisting: UnavailablePhoneVerificationDeliveryService,
    },
    PhoneVerificationService,
  ],
  exports: [PhoneVerificationCodeService, PhoneVerificationService],
})
export class PhoneVerificationModule {}
