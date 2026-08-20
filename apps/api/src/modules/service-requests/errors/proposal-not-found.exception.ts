import { NotFoundException } from "@nestjs/common";

export class ProposalNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PROPOSAL_NOT_FOUND",
      message: "Proposta não encontrada.",
    });
  }
}
