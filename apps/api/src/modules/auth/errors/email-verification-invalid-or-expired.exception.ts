import { BadRequestException } from "@nestjs/common";

export class EmailVerificationInvalidOrExpiredException extends BadRequestException {
  constructor() {
    super({
      code: "EMAIL_VERIFICATION_INVALID_OR_EXPIRED",
      message: "O link de confirmacao de e-mail e invalido ou expirou.",
    });
  }
}
