import { PublicCategorySuggestionStatus } from "../../../generated/prisma/client";

export type PublicCategorySuggestionAdminRecord = {
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

export class PublicCategorySuggestionAdminResponseDto {
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

  constructor(record: PublicCategorySuggestionAdminRecord) {
    this.id = record.id;
    this.suggestedName = record.suggestedName;
    this.description = record.description;
    this.status = record.status;
    this.createdAt = record.createdAt;
    this.name = record.name;
    this.email = record.email;
    this.phone = record.phone;
    this.reviewNotes = record.reviewNotes;
    this.reviewedAt = record.reviewedAt;
  }
}
