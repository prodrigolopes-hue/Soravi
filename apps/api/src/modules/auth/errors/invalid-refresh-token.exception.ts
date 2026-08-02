import { UnauthorizedException } from "@nestjs/common";

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: "INVALID_REFRESH_TOKEN",
      message:
        "O refresh token é inválido, expirou ou já foi utilizado.",
    });
  }
}