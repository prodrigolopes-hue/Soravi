import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

import { EstimatedDurationUnit } from "../../../generated/prisma/client";

export class CreateProposalDto {
  @Type(() => Number)
  @IsInt({ message: "O valor da proposta deve ser um inteiro." })
  @Min(1, { message: "O valor da proposta deve ser maior que zero." })
  amountInCents!: number;

  @Type(() => Number)
  @IsInt({ message: "O prazo estimado deve ser um inteiro." })
  @Min(1, { message: "O prazo estimado deve ser maior que zero." })
  estimatedDurationValue!: number;

  @IsEnum(EstimatedDurationUnit, {
    message: "A unidade do prazo estimado é inválida.",
  })
  estimatedDurationUnit!: EstimatedDurationUnit;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "A mensagem deve ser um texto." })
  @IsNotEmpty({ message: "A mensagem é obrigatória." })
  @MaxLength(2000, { message: "A mensagem deve ter no máximo 2000 caracteres." })
  message!: string;
}