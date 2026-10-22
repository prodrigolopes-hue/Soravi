import type { Metadata } from "next";

import { CategoryProfessionalsPage } from "../../../components/discovery/category-professionals-page";

export const metadata: Metadata = {
  title: "Profissionais por categoria | Soravi",
  description: "Conheça profissionais disponíveis por categoria na Soravi.",
};

export default async function CategoryProfessionalsRoute({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  return <CategoryProfessionalsPage categorySlug={categorySlug} />;
}
