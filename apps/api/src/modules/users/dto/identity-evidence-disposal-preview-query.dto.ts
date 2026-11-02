import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class IdentityEvidenceDisposalPreviewQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
