import { ProfessionalVerificationStatus } from "../../../generated/prisma/client";

export interface ProfessionalVerificationReviewRecord {
  userId: string;
  verificationStatus: ProfessionalVerificationStatus;
  reviewedAt: Date;
  reviewedByUserId: string;
  reviewNotes: string | null;
}

export class ProfessionalVerificationReviewResponseDto {
  userId: string;
  verificationStatus: ProfessionalVerificationStatus;
  reviewedAt: Date;
  reviewedByUserId: string;
  reviewNotes: string | null;

  constructor(record: ProfessionalVerificationReviewRecord) {
    this.userId = record.userId;
    this.verificationStatus = record.verificationStatus;
    this.reviewedAt = record.reviewedAt;
    this.reviewedByUserId = record.reviewedByUserId;
    this.reviewNotes = record.reviewNotes;
  }
}
