import { ForbiddenException } from "@nestjs/common";

export class CustomerProfileActivationUnavailableException extends ForbiddenException {
  constructor() {
    super({
      code: "CUSTOMER_PROFILE_ACTIVATION_UNAVAILABLE",
      message: "A conta não está elegível para ativar o perfil cliente.",
    });
  }
}
