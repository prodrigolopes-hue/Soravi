import { ForbiddenException } from "@nestjs/common";

export class ContractActionForbiddenException extends ForbiddenException {
  constructor() {
    super({
      code: "CONTRACT_ACTION_FORBIDDEN",
      message: "Sua conta não pode executar esta ação nesta contratação.",
    });
  }
}
