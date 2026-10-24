import { apiBaseUrl, categoriesUrl } from "./api";

const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/u, "");

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicReputation {
  averageRating: number;
  reviewCount: number;
}

export interface PublicProfessionalPhoto {
  url: string;
  expiresAt: string;
}

export interface PublicProfessionalListItem {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  categories: PublicCategory[];
  reputation: PublicReputation;
  photo: PublicProfessionalPhoto | null;
}

export interface PublicPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PublicProfessionalsResponse {
  items: PublicProfessionalListItem[];
  pagination: PublicPagination;
}

export interface PublicProfessionalReview {
  rating: number;
  comment: string | null;
  publishedAt: string;
}

export interface PublicProfessionalProfile extends PublicProfessionalListItem {
  bio: string | null;
  reviews: {
    items: PublicProfessionalReview[];
    pagination: PublicPagination;
  };
}

export function categoryProfessionalsUrl(
  categorySlug: string,
  page: number,
  limit: number,
): string {
  const url = new URL(
    `${normalizedApiBaseUrl}/api/v1/categories/${encodeURIComponent(categorySlug)}/professionals`,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function publicProfessionalUrl(
  professionalProfileId: string,
  page: number,
  limit: number,
): string {
  const url = new URL(
    `${normalizedApiBaseUrl}/api/v1/professionals/${encodeURIComponent(professionalProfileId)}`,
  );
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export { categoriesUrl };

export function parsePublicCategories(payload: unknown): PublicCategory[] | null {
  const root = unwrapData(payload);
  if (!Array.isArray(root)) return null;
  const categories: PublicCategory[] = [];
  for (const value of root) {
    const category = parseCategory(value);
    if (!category) return null;
    categories.push(category);
  }
  return categories;
}

export function parsePublicProfessionalsResponse(payload: unknown): PublicProfessionalsResponse | null {
  const root = unwrapData(payload);
  if (!isRecord(root) || !Array.isArray(root.items)) return null;
  const pagination = parsePagination(root.pagination);
  if (!pagination) return null;
  const items: PublicProfessionalListItem[] = [];
  for (const value of root.items) {
    const item = parseProfessionalListItem(value);
    if (!item) return null;
    items.push(item);
  }
  return { items, pagination };
}

export function parsePublicProfessionalProfile(payload: unknown): PublicProfessionalProfile | null {
  const root = unwrapData(payload);
  if (!isRecord(root) || !isNullableString(root.bio) || !isRecord(root.reviews)) return null;
  const base = parseProfessionalListItem(root);
  const reviewsRoot = root.reviews;
  if (!base || !Array.isArray(reviewsRoot.items)) return null;
  const pagination = parsePagination(reviewsRoot.pagination);
  if (!pagination) return null;
  const reviews: PublicProfessionalReview[] = [];
  for (const value of reviewsRoot.items) {
    if (!isRecord(value) || !isIntegerInRange(value.rating, 1, 5) || !isNullableString(value.comment) || typeof value.publishedAt !== "string" || Number.isNaN(Date.parse(value.publishedAt))) return null;
    reviews.push({ rating: value.rating, comment: value.comment, publishedAt: value.publishedAt });
  }
  return { ...base, bio: root.bio, reviews: { items: reviews, pagination } };
}

function parseProfessionalListItem(value: unknown): PublicProfessionalListItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.displayName !== "string" || !isNullableString(value.professionalTitle) || !isNullableString(value.serviceArea) || !Array.isArray(value.categories) || !isRecord(value.reputation) || !isProfessionalPhoto(value.photo)) return null;
  const categories: PublicCategory[] = [];
  for (const item of value.categories) {
    const category = parseCategory(item);
    if (!category) return null;
    categories.push(category);
  }
  const { reputation } = value;
  if (!isNonNegativeFiniteNumber(reputation.averageRating) || !isNonNegativeInteger(reputation.reviewCount)) return null;
  return {
    id: value.id,
    displayName: value.displayName,
    professionalTitle: value.professionalTitle,
    serviceArea: value.serviceArea,
    categories,
    reputation: { averageRating: reputation.averageRating, reviewCount: reputation.reviewCount },
    photo: value.photo,
  };
}

function parseCategory(value: unknown): PublicCategory | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.slug !== "string") return null;
  return { id: value.id, name: value.name, slug: value.slug };
}

function parsePagination(value: unknown): PublicPagination | null {
  if (!isRecord(value) || !isPositiveInteger(value.page) || !isPositiveInteger(value.limit) || !isNonNegativeInteger(value.total) || !isNonNegativeInteger(value.totalPages)) return null;
  return { page: value.page, limit: value.limit, total: value.total, totalPages: value.totalPages };
}

function unwrapData(value: unknown): unknown {
  return isRecord(value) && isRecord(value.data) ? value.data : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isProfessionalPhoto(value: unknown): value is PublicProfessionalPhoto | null {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.url !== "string" || typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt))) return false;
  try {
    return new URL(value.url).protocol === "https:";
  } catch {
    return false;
  }
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}
