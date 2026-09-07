import { BadRequestException } from "@nestjs/common";

export class PasswordTooCommonException extends BadRequestException {
  constructor() {
    super({
      code: "PASSWORD_TOO_COMMON",
      message: "Escolha uma senha menos comum e difícil de adivinhar.",
    });
  }
}
