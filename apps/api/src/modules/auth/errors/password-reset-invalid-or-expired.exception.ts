import { BadRequestException } from "@nestjs/common";

export class PasswordResetInvalidOrExpiredException extends BadRequestException {
  constructor() {
    super({
      code: "PASSWORD_RESET_INVALID_OR_EXPIRED",
      message:
        "O link de redefinição é inválido ou expirou. Solicite um novo link.",
    });
  }
}
