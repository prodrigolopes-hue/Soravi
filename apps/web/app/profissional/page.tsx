import type { Metadata } from "next";

import { ProfessionalDashboardPage } from "../../components/professional/professional-dashboard-page";

export const metadata: Metadata = { title: "Painel do profissional | Soravi", description: "Resumo de oportunidades e serviços na Soravi." };

export default function ProfessionalDashboardRoute() { return <ProfessionalDashboardPage />; }
