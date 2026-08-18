import { PayloadTooLargeException } from "@nestjs/common";

export class ServiceRequestPhotoTooLargeException extends PayloadTooLargeException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_PHOTO_TOO_LARGE",
      message: "A foto deve ter no máximo 5 MB.",
    });
  }
}