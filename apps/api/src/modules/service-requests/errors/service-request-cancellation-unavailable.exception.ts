import { ConflictException } from "@nestjs/common";

export class ServiceRequestCancellationUnavailableException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_CANCELLATION_UNAVAILABLE",
      message: "A solicitação não pode ser cancelada diretamente.",
    });
  }
}
