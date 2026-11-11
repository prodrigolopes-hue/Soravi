import { IsEnum, IsString, MaxLength } from "class-validator";
import { IdentityVerificationResult } from "../../../generated/prisma/client";

export class DecideProfessionalIdentityDto {
  @IsEnum({ CONFIRMED: IdentityVerificationResult.CONFIRMED, NOT_CONFIRMED: IdentityVerificationResult.NOT_CONFIRMED, INCONCLUSIVE: IdentityVerificationResult.INCONCLUSIVE })
  result!: "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE";

  @IsString() @MaxLength(64)
  reasonCode!: string;

  @IsString() @MaxLength(64)
  criteriaVersion!: string;
}
