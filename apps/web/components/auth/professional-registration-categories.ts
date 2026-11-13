export interface ProfessionalCategoryRequestInput {
  suggestedName: string;
  description?: string;
}

export function professionalCategorySelectionError(
  categorySlugs: string[],
  categoryRequests: ProfessionalCategoryRequestInput[],
): string | null {
  const total = categorySlugs.length + categoryRequests.length;

  if (total === 0) return "Selecione pelo menos uma categoria oficial ou sugira uma categoria.";
  if (total > 3) return "Selecione no máximo três categorias entre oficiais e sugeridas.";
  return null;
}

export function professionalCategoryRegistrationPayload(
  categorySlugs: string[],
  categoryRequests: ProfessionalCategoryRequestInput[],
) {
  return { categorySlugs, categoryRequests };
}
