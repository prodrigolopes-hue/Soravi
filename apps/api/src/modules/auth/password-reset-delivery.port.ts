export interface SendPasswordResetInput {
  email: string;
  rawToken: string;
  expiresAt: Date;
}

export interface PasswordResetDeliveryPort {
  sendReset(input: SendPasswordResetInput): Promise<void>;
}

export const PASSWORD_RESET_DELIVERY_PORT = Symbol(
  "PASSWORD_RESET_DELIVERY_PORT",
);

export class PasswordResetDeliveryError extends Error {
  constructor(readonly code: string) {
    super("Password reset delivery failed.");
    this.name = PasswordResetDeliveryError.name;
  }
}
