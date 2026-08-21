import {
  ContractStatus,
  ConversationStatus,
  EstimatedDurationUnit,
  ServiceRequestStatus,
} from "../../../generated/prisma/client";

export interface ConversationResponseDtoProperties {
  id: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  contract: {
    id: string;
    status: ContractStatus;
    agreedAmountInCents: number;
    agreedDurationValue: number;
    agreedDurationUnit: EstimatedDurationUnit;
    acceptedAt: Date;
  };
  serviceRequest: {
    id: string;
    title: string;
    status: ServiceRequestStatus;
  };
  participantRole: "CUSTOMER" | "PROFESSIONAL";
}

export class ConversationResponseDto {
  readonly id: string;
  readonly status: ConversationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly closedAt: Date | null;
  readonly contract: {
    id: string;
    status: ContractStatus;
    agreedAmountInCents: number;
    agreedDurationValue: number;
    agreedDurationUnit: EstimatedDurationUnit;
    acceptedAt: Date;
  };
  readonly serviceRequest: {
    id: string;
    title: string;
    status: ServiceRequestStatus;
  };
  readonly participantRole: "CUSTOMER" | "PROFESSIONAL";

  constructor(properties: ConversationResponseDtoProperties) {
    this.id = properties.id;
    this.status = properties.status;
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.closedAt = properties.closedAt;
    this.contract = properties.contract;
    this.serviceRequest = properties.serviceRequest;
    this.participantRole = properties.participantRole;
  }
}
