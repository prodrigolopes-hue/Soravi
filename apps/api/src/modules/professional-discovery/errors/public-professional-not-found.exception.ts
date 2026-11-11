import { NotFoundException } from "@nestjs/common";

export class PublicProfessionalNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PUBLIC_PROFESSIONAL_NOT_FOUND",
      message: "Profissional não encontrado.",
    });
  }
}
