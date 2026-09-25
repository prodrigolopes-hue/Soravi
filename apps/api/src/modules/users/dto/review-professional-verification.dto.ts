import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

import { ProfessionalVerificationStatus } from "../../../generated/prisma/client";

const REVIEWABLE_STATUSES = [
  ProfessionalVerificationStatus.APPROVED,
  ProfessionalVerificationStatus.REJECTED,
] as const;

export type ReviewableProfessionalVerificationStatus =
  (typeof REVIEWABLE_STATUSES)[number];

export class ReviewProfessionalVerificationDto {
  @IsEnum(
    {
      APPROVED: ProfessionalVerificationStatus.APPROVED,
      REJECTED: ProfessionalVerificationStatus.REJECTED,
    },
    { message: "O status deve ser APPROVED ou REJECTED." },
  )
  status!: ReviewableProfessionalVerificationStatus;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString({ message: "A nota de revisao deve ser um texto." })
  @MaxLength(1000, { message: "A nota de revisao deve possuir no maximo 1000 caracteres." })
  reviewNotes?: string;
}
