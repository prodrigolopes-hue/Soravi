import { IsString, Matches, MaxLength } from "class-validator";

export class IdentityEvidenceDisposalSuspensionDto {
  @IsString()
  @MaxLength(500)
  @Matches(/\S/)
  reason!: string;
}
