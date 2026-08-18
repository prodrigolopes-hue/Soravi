import { ConflictException } from "@nestjs/common";

export class ServiceRequestNotDraftException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_NOT_DRAFT",
      message: "Fotos só podem ser adicionadas a solicitações em rascunho.",
    });
  }
}