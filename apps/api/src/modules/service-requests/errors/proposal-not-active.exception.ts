import { ConflictException } from "@nestjs/common";

export class ProposalNotActiveException extends ConflictException {
  constructor() {
    super({
      code: "PROPOSAL_NOT_ACTIVE",
      message: "A proposta não está mais ativa.",
    });
  }
}
