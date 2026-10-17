import { ConflictException } from "@nestjs/common";

export class ServiceRequestOwnProfessionalCategoryException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_OWN_PROFESSIONAL_CATEGORY",
      message: "Não é possível solicitar serviço em uma categoria do seu perfil profissional.",
    });
  }
}
