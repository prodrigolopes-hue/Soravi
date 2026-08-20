import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

import { ProposalStatus } from "../../../generated/prisma/client";

export const PROPOSAL_SORT_VALUES = ["asc", "desc"] as const;

export type ProposalSort = (typeof PROPOSAL_SORT_VALUES)[number];

export class ProposalsReceivedQueryDto {
  @IsOptional()
  @IsEnum(ProposalStatus, {
    message: "O status informado é inválido.",
  })
  status?: ProposalStatus;

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
  @IsIn(PROPOSAL_SORT_VALUES, {
    message: "O parâmetro sort deve ser asc ou desc.",
  })
  sort?: ProposalSort = "desc";
}