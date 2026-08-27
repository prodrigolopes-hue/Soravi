import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface PhoneVerificationCodeContext {
  challengeId: string;
  userId: string;
  phoneNormalized: string;
  code: string;
}

export interface VerifyPhoneVerificationCodeInput
  extends PhoneVerificationCodeContext {
  expectedHash: string;
}

const CODE_UPPER_BOUND = 1_000_000;
const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/;

@Injectable()
export class PhoneVerificationCodeService {
  private readonly hmacSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.hmacSecret = this.configService.getOrThrow<string>(
      "PHONE_VERIFICATION_HMAC_SECRET",
    );
  }

  generateCode(): string {
    return randomInt(0, CODE_UPPER_BOUND).toString().padStart(6, "0");
  }

  hashCode(input: PhoneVerificationCodeContext): string {
    return createHmac("sha256", this.hmacSecret)
      .update(this.createContext(input))
      .digest("hex");
  }

  verifyCode(input: VerifyPhoneVerificationCodeInput): boolean {
    if (!SHA_256_HEX_PATTERN.test(input.expectedHash)) {
      return false;
    }

    const actualHash = Buffer.from(this.hashCode(input), "hex");
    const expectedHash = Buffer.from(input.expectedHash, "hex");

    if (actualHash.length !== expectedHash.length) {
      return false;
    }

    return timingSafeEqual(actualHash, expectedHash);
  }

  private createContext(input: PhoneVerificationCodeContext): string {
    return [
      input.challengeId,
      input.userId,
      input.phoneNormalized,
      input.code,
    ].join(":");
  }
}
