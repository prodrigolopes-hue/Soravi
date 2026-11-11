import { Transform } from "class-transformer";
import { IsEnum, IsString, MaxLength, MinLength } from "class-validator";

import { ContractReportStatus } from "../../../generated/prisma/client";

export class UpdateContractReportDto {
  @IsEnum(ContractReportStatus)
  status!: ContractReportStatus;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(1200)
  resolution!: string;
}
