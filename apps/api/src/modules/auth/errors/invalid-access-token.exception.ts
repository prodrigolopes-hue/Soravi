import { UnauthorizedException } from "@nestjs/common";

export class InvalidAccessTokenException extends UnauthorizedException {
  constructor() {
    super({
      code: "INVALID_ACCESS_TOKEN",
      message:
        "O token de acesso é inválido, expirou ou a sessão foi encerrada.",
    });
  }
}