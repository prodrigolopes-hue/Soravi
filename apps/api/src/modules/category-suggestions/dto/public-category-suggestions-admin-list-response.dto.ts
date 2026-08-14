import { PublicCategorySuggestionStatus } from "../../../generated/prisma/client";

export type PublicCategorySuggestionsAdminItemRecord = {
  id: string;
  suggestedName: string;
  description: string | null;
  status: PublicCategorySuggestionStatus;
  createdAt: Date;
  name: string;
  email: string;
  phone: string | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
};

export class PublicCategorySuggestionsAdminItemResponseDto {
  id!: string;
  suggestedName!: string;
  description!: string | null;
  status!: PublicCategorySuggestionStatus;
  createdAt!: Date;
  name!: string;
  email!: string;
  phone!: string | null;
  reviewNotes!: string | null;
  reviewedAt!: Date | null;

  constructor(properties: PublicCategorySuggestionsAdminItemRecord) {
    this.id = properties.id;
    this.suggestedName = properties.suggestedName;
    this.description = properties.description;
    this.status = properties.status;
    this.createdAt = properties.createdAt;
    this.name = properties.name;
    this.email = properties.email;
    this.phone = properties.phone;
    this.reviewNotes = properties.reviewNotes;
    this.reviewedAt = properties.reviewedAt;
  }
}

export class PublicCategorySuggestionsAdminPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class PublicCategorySuggestionsAdminListResponseDto {
  items!: PublicCategorySuggestionsAdminItemResponseDto[];
  pagination!: PublicCategorySuggestionsAdminPaginationResponseDto;

  constructor(
    items: PublicCategorySuggestionsAdminItemRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new PublicCategorySuggestionsAdminItemResponseDto(item),
    );

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}