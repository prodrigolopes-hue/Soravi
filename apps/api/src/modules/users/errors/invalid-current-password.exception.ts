import { ForbiddenException } from "@nestjs/common";

export class InvalidCurrentPasswordException extends ForbiddenException {
  constructor() {
    super({
      code: "INVALID_CURRENT_PASSWORD",
      message: "Não foi possível confirmar sua senha.",
    });
  }
}
