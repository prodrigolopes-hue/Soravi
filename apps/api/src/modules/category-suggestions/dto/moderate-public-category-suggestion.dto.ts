import { Transform } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { PublicCategorySuggestionStatus } from "../../../generated/prisma/client";

const MODERABLE_PUBLIC_CATEGORY_SUGGESTION_STATUSES = [
  PublicCategorySuggestionStatus.APPROVED,
  PublicCategorySuggestionStatus.REJECTED,
] as const;

type ModerablePublicCategorySuggestionStatus =
  (typeof MODERABLE_PUBLIC_CATEGORY_SUGGESTION_STATUSES)[number];

export class ModeratePublicCategorySuggestionDto {
  @IsEnum(
    {
      APPROVED: PublicCategorySuggestionStatus.APPROVED,
      REJECTED: PublicCategorySuggestionStatus.REJECTED,
    },
    {
      message: "O status deve ser APPROVED ou REJECTED.",
    },
  )
  status!: ModerablePublicCategorySuggestionStatus;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "A nota de revisão deve ser um texto.",
  })
  @MaxLength(1000, {
    message: "A nota de revisão deve possuir no máximo 1000 caracteres.",
  })
  reviewNotes?: string;
}
