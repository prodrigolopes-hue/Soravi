import type { Metadata } from "next";

import { ProfessionalOpportunitiesPage } from "../../../components/opportunities/professional-opportunities-page";

export const metadata: Metadata = {
  title: "Oportunidades | Soravi",
  description: "Acompanhe oportunidades de serviço compatíveis com suas categorias.",
};

export default function ProfessionalOpportunitiesRoute() {
  return <ProfessionalOpportunitiesPage />;
}