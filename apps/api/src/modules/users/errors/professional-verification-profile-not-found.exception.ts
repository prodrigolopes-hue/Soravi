import { NotFoundException } from "@nestjs/common";

export class ProfessionalVerificationProfileNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PROFESSIONAL_VERIFICATION_PROFILE_NOT_FOUND",
      message: "Perfil profissional n\u00e3o encontrado.",
    });
  }
}
