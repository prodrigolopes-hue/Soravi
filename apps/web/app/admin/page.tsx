import type { Metadata } from "next";

import { AdminDashboardPage } from "../../components/admin/admin-dashboard-page";

export const metadata: Metadata = {
  title: "Painel administrativo | Soravi",
  description: "Visão central da operação administrativa da Soravi.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return <AdminDashboardPage />;
}