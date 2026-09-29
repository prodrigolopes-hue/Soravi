export type ProfessionalVerificationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface ProfessionalCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProfessionalProfile {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  bio: string | null;
  isAvailable: boolean;
  verificationStatus: ProfessionalVerificationStatus;
  categories: ProfessionalCategory[];
}

export function parseProfessionalProfile(
  payload: unknown,
): ProfessionalProfile | null {
  const root = isRecord(payload) && isRecord(payload.data)
    ? payload.data
    : payload;

  if (
    !isRecord(root) ||
    typeof root.id !== "string" ||
    typeof root.displayName !== "string" ||
    !isNullableString(root.professionalTitle) ||
    !isNullableString(root.serviceArea) ||
    !isNullableString(root.bio) ||
    typeof root.isAvailable !== "boolean" ||
    !isProfessionalVerificationStatus(root.verificationStatus) ||
    !Array.isArray(root.categories)
  ) {
    return null;
  }

  const categories: ProfessionalCategory[] = [];

  for (const value of root.categories) {
    const category = parseProfessionalCategory(value);

    if (!category) {
      return null;
    }

    categories.push(category);
  }

  return {
    id: root.id,
    displayName: root.displayName,
    professionalTitle: root.professionalTitle,
    serviceArea: root.serviceArea,
    bio: root.bio,
    isAvailable: root.isAvailable,
    verificationStatus: root.verificationStatus,
    categories,
  };
}

export function parseProfessionalCategories(
  payload: unknown,
): ProfessionalCategory[] | null {
  const root = isRecord(payload) && Array.isArray(payload.data)
    ? payload.data
    : payload;

  if (!Array.isArray(root)) {
    return null;
  }

  const categories: ProfessionalCategory[] = [];

  for (const value of root) {
    const category = parseProfessionalCategory(value);

    if (!category) {
      return null;
    }

    categories.push(category);
  }

  return categories;
}

function parseProfessionalCategory(value: unknown): ProfessionalCategory | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string"
  ) {
    return null;
  }

  return { id: value.id, name: value.name, slug: value.slug };
}

function isProfessionalVerificationStatus(
  value: unknown,
): value is ProfessionalVerificationStatus {
  return value === "NOT_STARTED" || value === "PENDING" ||
    value === "APPROVED" || value === "REJECTED";
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
