import {
  ForbiddenException,
  HttpStatus,
} from "@nestjs/common";

export class AccountUnavailableException extends ForbiddenException {
  constructor() {
    super({
      statusCode: HttpStatus.FORBIDDEN,
      code: "ACCOUNT_UNAVAILABLE",
      message: "Esta conta não está disponível para acesso.",
    });
  }
}