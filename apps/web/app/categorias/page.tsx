import type { Metadata } from "next";
import { CategoryDirectory } from "../../components/discovery/category-directory";

export const metadata: Metadata = { title: "Categorias de serviços | Soravi", description: "Encontre categorias de serviços na Soravi." };

export default function CategoriesPage() {
  return <CategoryDirectory />;
}
