import type { Metadata } from "next";

import { AdminCategoriesPage } from "../../../components/admin/admin-categories-page";

export const metadata: Metadata = {
  title: "Categorias | Administração Soravi",
  description: "Listagem administrativa de categorias e solicitações da Soravi.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminCategoriesRoute() {
  return <AdminCategoriesPage />;
}