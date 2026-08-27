import { Module } from "@nestjs/common";

import { PhoneVerificationCodeService } from "./phone-verification-code.service";

@Module({
  providers: [PhoneVerificationCodeService],
  exports: [PhoneVerificationCodeService],
})
export class PhoneVerificationModule {}
