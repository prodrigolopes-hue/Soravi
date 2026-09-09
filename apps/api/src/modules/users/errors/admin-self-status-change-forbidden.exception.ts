import { ForbiddenException } from "@nestjs/common";

export class AdminSelfStatusChangeForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: "ADMIN_SELF_STATUS_CHANGE_FORBIDDEN",
      message: "O administrador não pode alterar o próprio status.",
    });
  }
}
