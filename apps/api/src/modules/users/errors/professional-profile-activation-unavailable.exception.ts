import { ForbiddenException } from "@nestjs/common";

export class ProfessionalProfileActivationUnavailableException extends ForbiddenException {
  constructor() {
    super({
      code: "PROFESSIONAL_PROFILE_ACTIVATION_UNAVAILABLE",
      message: "A conta não está elegível para ativar o perfil profissional.",
    });
  }
}
