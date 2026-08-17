import { NotFoundException } from "@nestjs/common";

export class ServiceRequestNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_NOT_FOUND",
      message: "Solicitação de serviço não encontrada.",
    });
  }
}
