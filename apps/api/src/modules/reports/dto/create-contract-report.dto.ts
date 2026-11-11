import { Transform } from "class-transformer";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

import { ContractReportReason } from "../../../generated/prisma/client";

export class CreateContractReportDto {
  @IsEnum(ContractReportReason)
  reason!: ContractReportReason;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(1200)
  description!: string;
}
