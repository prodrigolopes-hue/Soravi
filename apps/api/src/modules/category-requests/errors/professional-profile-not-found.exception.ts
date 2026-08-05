import { NotFoundException } from "@nestjs/common";

export class ProfessionalProfileNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PROFESSIONAL_PROFILE_NOT_FOUND",
      message: "Perfil profissional não encontrado para o usuário autenticado.",
    });
  }
}
