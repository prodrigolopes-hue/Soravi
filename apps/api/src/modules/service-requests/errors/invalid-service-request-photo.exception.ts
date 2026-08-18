import { BadRequestException } from "@nestjs/common";

export class InvalidServiceRequestPhotoException extends BadRequestException {
  constructor(message = "A foto enviada é inválida.") {
    super({
      code: "INVALID_SERVICE_REQUEST_PHOTO",
      message,
    });
  }
}