import { NotFoundException } from "@nestjs/common";

export class ProposalCreationUnavailableException extends NotFoundException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_NOT_AVAILABLE",
      message: "Solicitação não encontrada ou indisponível.",
    });
  }
}