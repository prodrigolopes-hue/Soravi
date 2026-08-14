import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const PHONE_PATTERN = /^\+?[0-9()\-\s]{10,32}$/;

export class CreatePublicCategorySuggestionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({
    message: "O nome deve ser um texto.",
  })
  @MinLength(2, {
    message: "O nome deve possuir pelo menos 2 caracteres.",
  })
  @MaxLength(120, {
    message: "O nome deve possuir no máximo 120 caracteres.",
  })
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsEmail({}, {
    message: "Informe um e-mail válido.",
  })
  @MaxLength(254, {
    message: "O e-mail deve possuir no máximo 254 caracteres.",
  })
  email!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "O telefone deve ser um texto.",
  })
  @MaxLength(32, {
    message: "O telefone deve possuir no máximo 32 caracteres.",
  })
  @Matches(PHONE_PATTERN, {
    message: "Informe um telefone válido.",
  })
  phone?: string;

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

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "A descrição deve ser um texto.",
  })
  @MaxLength(1000, {
    message: "A descrição deve possuir no máximo 1000 caracteres.",
  })
  description?: string;

  @IsBoolean({
    message: "O aceite do aviso de privacidade deve ser booleano.",
  })
  @Equals(true, {
    message: "O aviso de privacidade deve ser aceito.",
  })
  privacyNoticeAccepted!: boolean;
}
