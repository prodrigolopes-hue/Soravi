import {
  EmailVerificationDeliveryError,
  EmailVerificationDeliveryPort,
  SendEmailVerificationInput,
} from "./email-verification-delivery.port";

export class UnavailableEmailVerificationDeliveryService
  implements EmailVerificationDeliveryPort
{
  sendVerification(_input: SendEmailVerificationInput): Promise<void> {
    return Promise.reject(
      new EmailVerificationDeliveryError("DELIVERY_NOT_CONFIGURED"),
    );
  }
}
