export interface ProfessionalDashboardResponseProperties {
  opportunitiesAvailable: number;
  proposalsSent: number;
  servicesContractedOrInProgress: number;
  servicesCompleted: number;
  averageRating: number;
  reviewCount: number;
  recentOpportunities: Array<{ id: string; createdAt: Date; title: string; categoryName: string; city: string; state: string }>;
  recentServices: Array<{ id: string; status: string; title: string; completedAt: Date | null }>;
}

export class ProfessionalDashboardResponseDto {
  opportunitiesAvailable!: number;
  proposalsSent!: number;
  servicesContractedOrInProgress!: number;
  servicesCompleted!: number;
  averageRating!: number;
  reviewCount!: number;
  recentOpportunities!: ProfessionalDashboardResponseProperties["recentOpportunities"];
  recentServices!: ProfessionalDashboardResponseProperties["recentServices"];

  constructor(properties: ProfessionalDashboardResponseProperties) {
    Object.assign(this, properties);
  }
}
