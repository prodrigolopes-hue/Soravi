import {
  ContractStatus,
  EstimatedDurationUnit,
  ProposalStatus,
  ServiceRequestStatus,
} from "../../../generated/prisma/client";

export interface AdminServiceRequestDetailResponseProperties {
  id: string;
  publicCode: string;
  title: string;
  description: string | null;
  status: ServiceRequestStatus;
  category: { id: string; name: string; slug: string };
  region: { country: string; state: string; city: string; neighborhood: string };
  customer: { id: string; name: string };
  targetProfessional: { id: string; displayName: string } | null;
  dates: { createdAt: Date; publishedAt: Date | null; hiredAt: Date | null; startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null };
  cancellationReason: string | null;
  opportunities: Array<{ professional: { id: string; displayName: string }; createdAt: Date; viewedAt: Date | null }>;
  proposals: Array<{ id: string; professional: { id: string; displayName: string }; amountInCents: number; estimatedDurationValue: number; estimatedDurationUnit: EstimatedDurationUnit; conditions: string; status: ProposalStatus; isVisible: boolean; submittedAt: Date; acceptedAt: Date | null; rejectedAt: Date | null; withdrawnAt: Date | null; expiredAt: Date | null }>;
  contract: { id: string; status: ContractStatus; acceptedProposalId: string; professional: { id: string; displayName: string }; agreedAmountInCents: number; agreedDurationValue: number; agreedDurationUnit: EstimatedDurationUnit; conditions: string; acceptedAt: Date; startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null; cancellationReason: string | null } | null;
}

export class AdminServiceRequestDetailResponseDto {
  readonly id: string;
  readonly publicCode: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: ServiceRequestStatus;
  readonly category: AdminServiceRequestDetailResponseProperties["category"];
  readonly region: AdminServiceRequestDetailResponseProperties["region"];
  readonly customer: AdminServiceRequestDetailResponseProperties["customer"];
  readonly targetProfessional: AdminServiceRequestDetailResponseProperties["targetProfessional"];
  readonly dates: AdminServiceRequestDetailResponseProperties["dates"];
  readonly cancellationReason: string | null;
  readonly opportunities: AdminServiceRequestDetailResponseProperties["opportunities"];
  readonly proposals: AdminServiceRequestDetailResponseProperties["proposals"];
  readonly contract: AdminServiceRequestDetailResponseProperties["contract"];

  constructor(properties: AdminServiceRequestDetailResponseProperties) {
    this.id = properties.id;
    this.publicCode = properties.publicCode;
    this.title = properties.title;
    this.description = properties.description;
    this.status = properties.status;
    this.category = properties.category;
    this.region = properties.region;
    this.customer = properties.customer;
    this.targetProfessional = properties.targetProfessional;
    this.dates = properties.dates;
    this.cancellationReason = properties.cancellationReason;
    this.opportunities = properties.opportunities;
    this.proposals = properties.proposals;
    this.contract = properties.contract;
  }
}
