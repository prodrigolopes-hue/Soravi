import { CategoryRequestStatus } from "../../../generated/prisma/client";

export interface CategoryRequestResponseDtoProperties {
  id: string;
  suggestedName: string;
  description: string | null;
  status: CategoryRequestStatus;
  reviewNotes?: string | null;
  resolvedCategory?: { id: string; name: string; slug: string } | null;
  resolvedCategories?: Array<{ id: string; name: string; slug: string } | { category: { id: string; name: string; slug: string } }>;
  createdAt: Date;
}

export class CategoryRequestResponseDto {
  readonly id: string;
  readonly suggestedName: string;
  readonly description: string | null;
  readonly status: CategoryRequestStatus;
  readonly reviewNotes?: string | null;
  readonly resolvedCategory?: { id: string; name: string; slug: string } | null;
  readonly resolvedCategories?: Array<{ id: string; name: string; slug: string }>;
  readonly createdAt: Date;

  constructor(properties: CategoryRequestResponseDtoProperties) {
    this.id = properties.id;
    this.suggestedName = properties.suggestedName;
    this.description = properties.description;
    this.status = properties.status;
    if (properties.reviewNotes !== undefined) this.reviewNotes = properties.reviewNotes;
    if (properties.resolvedCategory !== undefined) this.resolvedCategory = properties.resolvedCategory;
    if (properties.resolvedCategories !== undefined) this.resolvedCategories = properties.resolvedCategories.map((item) => "category" in item ? item.category : item);
    this.createdAt = properties.createdAt;
  }
}
