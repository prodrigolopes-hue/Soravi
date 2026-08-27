import { BadRequestException } from "@nestjs/common";

export class InvalidPhoneVerificationCodeException extends BadRequestException {
  constructor() {
    super({
      code: "INVALID_PHONE_VERIFICATION_CODE",
      message: "Código de verificação inválido ou expirado.",
    });
  }
}
