import { ConflictException } from "@nestjs/common";

export class ProfessionalCategoryOpenServiceRequestException extends ConflictException {
  constructor() {
    super({
      code: "PROFESSIONAL_CATEGORY_OPEN_SERVICE_REQUEST",
      message: "Não é possível adicionar uma categoria com solicitação própria em aberto.",
    });
  }
}
