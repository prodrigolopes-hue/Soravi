import type { Metadata } from "next";

import { MyServiceRequestsPage } from "../../components/service-requests/my-service-requests-page";

export const metadata: Metadata = {
  title: "Minhas solicitações | Soravi",
  description: "Acompanhe suas solicitações de serviço na Soravi.",
};

export default function ServiceRequestsRoute() {
  return <MyServiceRequestsPage />;
}