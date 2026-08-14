import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import { Role } from "../../../generated/prisma/client";

const INITIAL_REGISTRATION_ROLES = [
  Role.CUSTOMER,
  Role.PROFESSIONAL,
] as const;

type InitialRegistrationRole =
  (typeof INITIAL_REGISTRATION_ROLES)[number];

export class RegisterUserDto {
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
    typeof value === "string"
      ? value.trim().toLowerCase()
      : value,
  )
  @IsEmail(
    {},
    {
      message: "Informe um e-mail válido.",
    },
  )
  @MaxLength(254, {
    message: "O e-mail deve possuir no máximo 254 caracteres.",
  })
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({
    message: "O telefone deve ser um texto.",
  })
  @Matches(/^\+?[0-9()\-\s]{10,24}$/, {
    message: "Informe um telefone válido.",
  })
  phone?: string;

  @IsString({
    message: "A senha deve ser um texto.",
  })
  @MinLength(12, {
    message: "A senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(128, {
    message: "A senha deve possuir no máximo 128 caracteres.",
  })
  @Matches(/[A-Za-zÀ-ÿ]/, {
    message: "A senha deve possuir pelo menos uma letra.",
  })
  @Matches(/[0-9]/, {
    message: "A senha deve possuir pelo menos um número.",
  })
  password!: string;

  @IsEnum(Role, {
    message: "O tipo de conta informado é inválido.",
  })
  initialRole!: InitialRegistrationRole;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  acceptedTermsVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  acceptedPrivacyPolicyVersion!: string;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item) =>
          typeof item === "string" ? item.trim() : item,
        )
      : value,
  )
  @IsOptional()
  @IsArray({ message: "As categorias devem ser uma lista." })
  @IsString({ each: true, message: "A categoria deve ser um texto." })
  @MinLength(1, {
    each: true,
    message: "A categoria deve possuir pelo menos 1 caractere.",
  })
  @ArrayMaxSize(3, {
    message: "Selecione no máximo três categorias.",
  })
  categorySlugs?: string[];
}