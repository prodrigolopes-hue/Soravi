import { NotFoundException } from "@nestjs/common";

export class CurrentProfessionalProfileNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "CURRENT_PROFESSIONAL_PROFILE_NOT_FOUND",
      message: "Perfil profissional ativo não encontrado.",
    });
  }
}
