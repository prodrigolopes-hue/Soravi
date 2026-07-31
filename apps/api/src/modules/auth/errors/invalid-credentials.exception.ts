import {
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      statusCode: HttpStatus.UNAUTHORIZED,
      code: "INVALID_CREDENTIALS",
      message: "E-mail ou senha inválidos.",
    });
  }
}