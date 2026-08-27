export interface SendPhoneVerificationOtpInput {
  challengeId: string;
  phoneNormalized: string;
  code: string;
  expiresAt: Date;
}

export interface PhoneVerificationDeliveryPort {
  sendOtp(input: SendPhoneVerificationOtpInput): Promise<void>;
}

export const PHONE_VERIFICATION_DELIVERY_PORT = Symbol(
  "PHONE_VERIFICATION_DELIVERY_PORT",
);

export type PhoneVerificationDeliveryFailureKind =
  | "TRANSIENT"
  | "PERMANENT";

export class PhoneVerificationDeliveryError extends Error {
  constructor(
    readonly kind: PhoneVerificationDeliveryFailureKind,
    readonly code: string,
  ) {
    super("Phone verification OTP delivery failed.");
    this.name = PhoneVerificationDeliveryError.name;
  }
}
