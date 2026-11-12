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

export interface ProfessionalProfilePhoto {
  url: string;
  expiresAt: string;
}
export interface ProfessionalCategoryRequest { id: string; suggestedName: string; status: "PENDING" | "APPROVED" | "REJECTED" | "MERGED"; reviewNotes: string | null; resolvedCategory: ProfessionalCategory | null; }
export interface ProfessionalPortfolioItem { id: string; url: string | null; expiresAt: string | null; caption: string | null; status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReasonCode: string | null; rejectionReason: string | null; }

export interface ProfessionalProfile {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  bio: string | null;
  isAvailable: boolean;
  verificationStatus: ProfessionalVerificationStatus;
  categories: ProfessionalCategory[];
  categoryRequests: ProfessionalCategoryRequest[];
  photo: ProfessionalProfilePhoto | null;
  portfolio: ProfessionalPortfolioItem[];
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
    !Array.isArray(root.categories) ||
    !isProfessionalProfilePhoto(root.photo) || !Array.isArray(root.portfolio) || (root.categoryRequests !== undefined && !Array.isArray(root.categoryRequests))
  ) {
    return null;
  }

  const categories: ProfessionalCategory[] = [];
  const portfolio: ProfessionalPortfolioItem[] = [];
  const categoryRequests: ProfessionalCategoryRequest[] = [];
  for (const value of root.categoryRequests ?? []) {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.suggestedName !== "string" || !["PENDING", "APPROVED", "REJECTED", "MERGED"].includes(String(value.status)) || !isNullableString(value.reviewNotes) || (value.resolvedCategory !== null && !parseProfessionalCategory(value.resolvedCategory))) return null;
    categoryRequests.push({ id: value.id, suggestedName: value.suggestedName, status: value.status as ProfessionalCategoryRequest["status"], reviewNotes: value.reviewNotes, resolvedCategory: value.resolvedCategory ? parseProfessionalCategory(value.resolvedCategory) : null });
  }
  for (const value of root.portfolio) {
    if (!isRecord(value) || typeof value.id !== "string" || !isNullableString(value.caption) || !isNullableString(value.rejectionReasonCode) || !isNullableString(value.rejectionReason) || !isNullableString(value.url) || !isNullableString(value.expiresAt) || !isProfessionalPortfolioStatus(value.status)) return null;
    portfolio.push({ id: value.id, caption: value.caption, url: value.url, expiresAt: value.expiresAt, status: value.status, rejectionReasonCode: value.rejectionReasonCode, rejectionReason: value.rejectionReason });
  }

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
    categoryRequests,
    photo: root.photo,
    portfolio,
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
function isProfessionalPortfolioStatus(value: unknown): value is "PENDING" | "APPROVED" | "REJECTED" { return value === "PENDING" || value === "APPROVED" || value === "REJECTED"; }

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isProfessionalProfilePhoto(
  value: unknown,
): value is ProfessionalProfilePhoto | null {
  return value === null || (
    isRecord(value) &&
    typeof value.url === "string" &&
    isValidAbsoluteUrl(value.url) &&
    typeof value.expiresAt === "string" &&
    !Number.isNaN(Date.parse(value.expiresAt))
  );
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
