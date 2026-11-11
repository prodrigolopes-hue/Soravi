export interface SendEmailVerificationInput {
  email: string;
  rawToken: string;
  expiresAt: Date;
}

export interface EmailVerificationDeliveryPort {
  sendVerification(input: SendEmailVerificationInput): Promise<void>;
}

export const EMAIL_VERIFICATION_DELIVERY_PORT = Symbol(
  "EMAIL_VERIFICATION_DELIVERY_PORT",
);

export class EmailVerificationDeliveryError extends Error {
  constructor(readonly code: string) {
    super("Email verification delivery failed.");
    this.name = EmailVerificationDeliveryError.name;
  }
}
