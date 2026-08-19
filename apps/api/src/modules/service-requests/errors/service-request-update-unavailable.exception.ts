import { ConflictException } from "@nestjs/common";

export class ServiceRequestUpdateUnavailableException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_UPDATE_UNAVAILABLE",
      message: "A solicitação não pode mais ser editada diretamente.",
    });
  }
}
