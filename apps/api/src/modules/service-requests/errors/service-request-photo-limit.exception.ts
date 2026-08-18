import { ConflictException } from "@nestjs/common";

export class ServiceRequestPhotoLimitException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_PHOTO_LIMIT_REACHED",
      message: "A solicitação já possui o limite de 5 fotos.",
    });
  }
}