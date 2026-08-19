import { ConflictException } from "@nestjs/common";

export class ServiceRequestPhotoUploadUnavailableException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_PHOTO_UPLOAD_UNAVAILABLE",
      message:
        "Fotos só podem ser adicionadas durante a janela inicial da solicitação.",
    });
  }
}