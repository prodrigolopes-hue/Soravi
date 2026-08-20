import { ConflictException } from "@nestjs/common";

export class ServiceRequestNotAcceptingProposalsException extends ConflictException {
  constructor() {
    super({
      code: "SERVICE_REQUEST_NOT_ACCEPTING_PROPOSALS",
      message: "A solicitação não aceita mais propostas.",
    });
  }
}