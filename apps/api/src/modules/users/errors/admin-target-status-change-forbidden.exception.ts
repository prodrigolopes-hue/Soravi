import { ForbiddenException } from "@nestjs/common";

export class AdminTargetStatusChangeForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: "ADMIN_TARGET_STATUS_CHANGE_FORBIDDEN",
      message:
        "O status de uma conta administrativa não pode ser alterado por este endpoint.",
    });
  }
}
