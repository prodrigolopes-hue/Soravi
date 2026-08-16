import { BadRequestException } from "@nestjs/common";

export class InvalidServiceRequestCategoryException extends BadRequestException {
  constructor() {
    super({
      code: "INVALID_SERVICE_REQUEST_CATEGORY",
      message: "Selecione uma categoria válida e ativa.",
    });
  }
}