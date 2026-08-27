import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { PhoneVerificationCodeService } from "./phone-verification-code.service";
import { PhoneVerificationController } from "./phone-verification.controller";
import { PhoneVerificationService } from "./phone-verification.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
    ThrottlerModule.forRoot([{ ttl: 600_000, limit: 10 }]),
  ],
  controllers: [PhoneVerificationController],
  providers: [PhoneVerificationCodeService, PhoneVerificationService],
  exports: [PhoneVerificationCodeService, PhoneVerificationService],
})
export class PhoneVerificationModule {}
