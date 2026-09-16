import { ConflictException } from "@nestjs/common";

export class ContractTransitionNotAllowedException extends ConflictException {
  constructor() {
    super({
      code: "CONTRACT_TRANSITION_NOT_ALLOWED",
      message: "A contratação não está em um status compatível com esta ação.",
    });
  }
}
