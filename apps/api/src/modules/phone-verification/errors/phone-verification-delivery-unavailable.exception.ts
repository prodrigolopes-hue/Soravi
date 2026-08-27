import { ServiceUnavailableException } from "@nestjs/common";

export class PhoneVerificationDeliveryUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({
      code: "PHONE_VERIFICATION_DELIVERY_UNAVAILABLE",
      message: "Não foi possível enviar o código de verificação.",
    });
  }
}
