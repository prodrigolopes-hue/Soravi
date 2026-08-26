import {
  EstimatedDurationUnit,
  ProposalStatus,
} from "../../../generated/prisma/client";

export interface ProposalReceivedProperties {
  id: string;
  amountInCents: number;
  estimatedDurationValue: number;
  estimatedDurationUnit: EstimatedDurationUnit;
  message: string;
  status: ProposalStatus;
  submittedAt: Date;
  professionalName: string | null;
}

export class ProposalReceivedResponseDto {
  id!: string;
  amountInCents!: number;
  estimatedDurationValue!: number;
  estimatedDurationUnit!: EstimatedDurationUnit;
  message!: string;
  status!: ProposalStatus;
  submittedAt!: Date;
  professionalName!: string | null;

  constructor(properties: ProposalReceivedProperties) {
    this.id = properties.id;
    this.amountInCents = properties.amountInCents;
    this.estimatedDurationValue = properties.estimatedDurationValue;
    this.estimatedDurationUnit = properties.estimatedDurationUnit;
    this.message = properties.message;
    this.status = properties.status;
    this.submittedAt = properties.submittedAt;
    this.professionalName = properties.professionalName;
  }
}

export class ProposalsReceivedPaginationResponseDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class ProposalsReceivedListResponseDto {
  items!: ProposalReceivedResponseDto[];
  pagination!: ProposalsReceivedPaginationResponseDto;

  constructor(
    items: ProposalReceivedProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map((item) => new ProposalReceivedResponseDto(item));
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
