import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

function trimOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

export class UpdateCurrentProfessionalProfileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O nome de exibição deve ser um texto." })
  @MinLength(2, {
    message: "O nome de exibição deve possuir pelo menos 2 caracteres.",
  })
  @MaxLength(120, {
    message: "O nome de exibição deve possuir no máximo 120 caracteres.",
  })
  displayName!: string;

  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString({ message: "O serviço principal deve ser um texto." })
  @MaxLength(80, {
    message: "O serviço principal deve possuir no máximo 80 caracteres.",
  })
  professionalTitle?: string | null;

  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString({ message: "A área de atendimento deve ser um texto." })
  @MaxLength(100, {
    message: "A área de atendimento deve possuir no máximo 100 caracteres.",
  })
  serviceArea?: string | null;

  @Transform(({ value }: { value: unknown }) => trimOptionalString(value))
  @IsOptional()
  @IsString({ message: "A descrição profissional deve ser um texto." })
  @MaxLength(1000, {
    message: "A descrição profissional deve possuir no máximo 1000 caracteres.",
  })
  bio?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? item.trim() : item))
      : value,
  )
  @IsArray({ message: "As categorias devem ser uma lista." })
  @ArrayMinSize(1, {
    message: "Selecione pelo menos uma categoria.",
  })
  @ArrayMaxSize(3, {
    message: "Selecione no máximo três categorias.",
  })
  @ArrayUnique({
    message: "Não selecione categorias duplicadas.",
  })
  @IsString({ each: true, message: "A categoria deve ser um texto." })
  @MinLength(1, {
    each: true,
    message: "A categoria deve possuir pelo menos 1 caractere.",
  })
  categorySlugs!: string[];

  @IsBoolean({ message: "A disponibilidade deve ser um valor booleano." })
  isAvailable!: boolean;
}
