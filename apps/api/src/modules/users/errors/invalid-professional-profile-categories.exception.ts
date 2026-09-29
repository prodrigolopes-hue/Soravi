import { BadRequestException } from "@nestjs/common";

export class InvalidProfessionalProfileCategoriesException extends BadRequestException {
  constructor() {
    super({
      code: "INVALID_PROFESSIONAL_PROFILE_CATEGORIES",
      message: "Selecione de 1 a 3 categorias ativas e sem duplicidade.",
    });
  }
}
