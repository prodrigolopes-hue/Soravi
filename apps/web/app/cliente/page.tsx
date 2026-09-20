import type { Metadata } from "next";

import { CustomerDashboardPage } from "../../components/customer/customer-dashboard-page";

export const metadata: Metadata = { title: "Painel do cliente | Soravi", description: "Resumo das suas solicitações e favoritos na Soravi." };

export default function CustomerDashboardRoute() { return <CustomerDashboardPage />; }
