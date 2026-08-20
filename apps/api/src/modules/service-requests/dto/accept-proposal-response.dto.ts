import {
  ContractStatus,
  ConversationStatus,
} from "../../../generated/prisma/client";

export interface AcceptProposalResponseProperties {
  contract: {
    id: string;
    status: ContractStatus;
    agreedAmountInCents: number;
    acceptedAt: Date;
  };
  conversation: {
    id: string;
    status: ConversationStatus;
  };
}

export class AcceptProposalResponseDto {
  readonly data: AcceptProposalResponseProperties;

  constructor(properties: AcceptProposalResponseProperties) {
    this.data = properties;
  }
}
