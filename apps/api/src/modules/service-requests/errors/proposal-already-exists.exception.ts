import { ConflictException } from "@nestjs/common";

export class ProposalAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      code: "PROPOSAL_ALREADY_EXISTS",
      message: "Já existe uma proposta para esta solicitação.",
    });
  }
}