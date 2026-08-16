import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

import { ServiceRequestStatus } from "../../../generated/prisma/client";

export const SERVICE_REQUEST_SORT_VALUES = ["asc", "desc"] as const;

export type ServiceRequestSort =
  (typeof SERVICE_REQUEST_SORT_VALUES)[number];

export class ServiceRequestsMineQueryDto {
  @IsOptional()
  @IsEnum(ServiceRequestStatus, {
    message: "O status informado é inválido.",
  })
  status?: ServiceRequestStatus;

  @IsOptional()
  @IsUUID("4", {
    message: "A categoria deve possuir um identificador válido.",
  })
  categoryId?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro page deve ser um inteiro." })
  @Min(1, { message: "O parâmetro page deve ser no mínimo 1." })
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro limit deve ser um inteiro." })
  @Min(1, { message: "O parâmetro limit deve ser no mínimo 1." })
  @Max(100, {
    message: "O parâmetro limit deve ser no máximo 100.",
  })
  limit?: number = 20;

  @IsOptional()
  @IsIn(SERVICE_REQUEST_SORT_VALUES, {
    message: "O parâmetro sort deve ser asc ou desc.",
  })
  sort?: ServiceRequestSort = "desc";
}