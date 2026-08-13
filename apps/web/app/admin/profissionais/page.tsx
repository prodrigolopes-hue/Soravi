import type { Metadata } from "next";

import { AdminProfessionalsPage } from "../../../components/admin/admin-professionals-page";

export const metadata: Metadata = {
  title: "Profissionais | Administração Soravi",
  description: "Listagem administrativa de profissionais da Soravi.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminProfessionalsRoute() {
  return <AdminProfessionalsPage />;
}
