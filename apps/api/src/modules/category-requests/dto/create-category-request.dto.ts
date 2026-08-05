import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateCategoryRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({
    message: "O nome sugerido deve ser um texto.",
  })
  @MinLength(2, {
    message: "O nome sugerido deve possuir pelo menos 2 caracteres.",
  })
  @MaxLength(120, {
    message: "O nome sugerido deve possuir no máximo 120 caracteres.",
  })
  suggestedName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({
    message: "A descrição deve ser um texto.",
  })
  @MaxLength(1000, {
    message: "A descrição deve possuir no máximo 1000 caracteres.",
  })
  description?: string;
}
