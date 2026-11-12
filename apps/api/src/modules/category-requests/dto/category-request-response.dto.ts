import { CategoryRequestStatus } from "../../../generated/prisma/client";

export interface CategoryRequestResponseDtoProperties {
  id: string;
  suggestedName: string;
  description: string | null;
  status: CategoryRequestStatus;
  reviewNotes?: string | null;
  resolvedCategory?: { id: string; name: string; slug: string } | null;
  createdAt: Date;
}

export class CategoryRequestResponseDto {
  readonly id: string;
  readonly suggestedName: string;
  readonly description: string | null;
  readonly status: CategoryRequestStatus;
  readonly reviewNotes?: string | null;
  readonly resolvedCategory?: { id: string; name: string; slug: string } | null;
  readonly createdAt: Date;

  constructor(properties: CategoryRequestResponseDtoProperties) {
    this.id = properties.id;
    this.suggestedName = properties.suggestedName;
    this.description = properties.description;
    this.status = properties.status;
    if (properties.reviewNotes !== undefined) this.reviewNotes = properties.reviewNotes;
    if (properties.resolvedCategory !== undefined) this.resolvedCategory = properties.resolvedCategory;
    this.createdAt = properties.createdAt;
  }
}
