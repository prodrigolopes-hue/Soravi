import {
  EstimatedDurationUnit,
  ProposalStatus,
} from "../../../generated/prisma/client";

export interface ProposalResponseProperties {
  id: string;
  serviceRequestId: string;
  amountInCents: number;
  estimatedDurationValue: number;
  estimatedDurationUnit: EstimatedDurationUnit;
  message: string;
  status: ProposalStatus;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ProposalResponseDto {
  id!: string;
  serviceRequestId!: string;
  amountInCents!: number;
  estimatedDurationValue!: number;
  estimatedDurationUnit!: EstimatedDurationUnit;
  message!: string;
  status!: ProposalStatus;
  submittedAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(properties: ProposalResponseProperties) {
    this.id = properties.id;
    this.serviceRequestId = properties.serviceRequestId;
    this.amountInCents = properties.amountInCents;
    this.estimatedDurationValue = properties.estimatedDurationValue;
    this.estimatedDurationUnit = properties.estimatedDurationUnit;
    this.message = properties.message;
    this.status = properties.status;
    this.submittedAt = properties.submittedAt;
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
  }
}