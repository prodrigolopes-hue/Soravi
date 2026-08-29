import {
  ForbiddenException,
  HttpStatus,
} from "@nestjs/common";

export class PhoneVerificationRequiredException extends ForbiddenException {
  constructor() {
    super({
      statusCode: HttpStatus.FORBIDDEN,
      code: "PHONE_VERIFICATION_REQUIRED",
      message: "Verifique seu telefone para continuar.",
    });
  }
}
