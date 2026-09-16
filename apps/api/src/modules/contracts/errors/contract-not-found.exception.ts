import { NotFoundException } from "@nestjs/common";

export class ContractNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "CONTRACT_NOT_FOUND",
      message: "Contratação não encontrada.",
    });
  }
}
