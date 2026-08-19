import type { Metadata } from "next";

import { ProfessionalOpportunityDetailsPage } from "../../../../components/opportunities/professional-opportunity-details-page";

export const metadata: Metadata = {
  title: "Detalhes da oportunidade | Soravi",
  description: "Consulte os detalhes de uma oportunidade de serviço.",
};

interface ProfessionalOpportunityDetailsRouteProps {
  params: Promise<{
    opportunityId: string;
  }>;
}

export default async function ProfessionalOpportunityDetailsRoute({
  params,
}: ProfessionalOpportunityDetailsRouteProps) {
  const { opportunityId } = await params;

  return (
    <ProfessionalOpportunityDetailsPage opportunityId={opportunityId} />
  );
}