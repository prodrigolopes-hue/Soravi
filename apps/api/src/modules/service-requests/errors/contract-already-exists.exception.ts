import { ConflictException } from "@nestjs/common";

export class ContractAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      code: "CONTRACT_ALREADY_EXISTS",
      message: "Já existe uma contratação para esta solicitação.",
    });
  }
}
