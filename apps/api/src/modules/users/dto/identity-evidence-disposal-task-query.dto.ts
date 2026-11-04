import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

import { IdentityEvidenceDisposalTaskStatus } from "../../../generated/prisma/client";

export class IdentityEvidenceDisposalTaskQueryDto {
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

  @IsOptional()
  @IsEnum(IdentityEvidenceDisposalTaskStatus)
  status?: IdentityEvidenceDisposalTaskStatus;
}
