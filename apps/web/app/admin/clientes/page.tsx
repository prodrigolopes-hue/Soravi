import type { Metadata } from "next";

import { AdminCustomersPage } from "../../../components/admin/admin-customers-page";

export const metadata: Metadata = {
  title: "Clientes | Administração Soravi",
  description: "Listagem administrativa de clientes da Soravi.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminCustomersRoute() {
  return <AdminCustomersPage />;
}
