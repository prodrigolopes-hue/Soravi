import type { PublicCategory } from "../../lib/professional-discovery";

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

export function filterCategoryDirectory(categories: PublicCategory[], query: string, sort: "az" | "za"): PublicCategory[] {
  const search = normalize(query);
  return categories.filter((item) => normalize(item.name).includes(search) || normalize(item.slug).includes(search)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR") * (sort === "az" ? 1 : -1));
}
