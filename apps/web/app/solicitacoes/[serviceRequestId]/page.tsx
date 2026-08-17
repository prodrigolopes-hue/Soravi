import type { Metadata } from "next";

import { ServiceRequestDetailsPage } from "../../../components/service-requests/service-request-details-page";

export const metadata: Metadata = {
  title: "Detalhes da solicitação | Soravi",
  description: "Consulte os detalhes da sua solicitação de serviço.",
};

interface ServiceRequestDetailsRouteProps {
  params: Promise<{
    serviceRequestId: string;
  }>;
}

export default async function ServiceRequestDetailsRoute({
  params,
}: ServiceRequestDetailsRouteProps) {
  const { serviceRequestId } = await params;

  return <ServiceRequestDetailsPage serviceRequestId={serviceRequestId} />;
}