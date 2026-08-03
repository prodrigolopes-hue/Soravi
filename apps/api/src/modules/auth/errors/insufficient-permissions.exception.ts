import { ForbiddenException } from "@nestjs/common";

export class InsufficientPermissionsException extends ForbiddenException {
  constructor() {
    super({
      code: "INSUFFICIENT_PERMISSIONS",
      message:
        "Você não possui permissão para acessar este recurso.",
    });
  }
}