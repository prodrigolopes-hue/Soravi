import type { Metadata } from "next";

import { NewServiceRequestPage } from "../../../components/service-requests/new-service-request-page";

export const metadata: Metadata = {
  title: "Nova solicitação | Soravi",
  description: "Descreva o serviço que você precisa e salve sua solicitação.",
};

export default function NewServiceRequestRoute() {
  return <NewServiceRequestPage />;
}