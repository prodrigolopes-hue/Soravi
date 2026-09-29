import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import { IsBrazilianPhone } from "../../../common/phone/is-brazilian-phone.decorator";
import { Role } from "../../../generated/prisma/client";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../password-policy/password-policy";

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
  @IsBrazilianPhone()
  phone?: string;

  @IsString({
    message: "A senha deve ser um texto.",
  })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: "A senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: "A senha deve possuir no máximo 128 caracteres.",
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

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @ValidateIf(
    (object: RegisterUserDto) =>
      object.initialRole === Role.PROFESSIONAL ||
      object.professionalTitle !== undefined,
  )
  @IsString({ message: "O serviço principal deve ser um texto." })
  @MinLength(3, {
    message: "O serviço principal deve possuir pelo menos 3 caracteres.",
  })
  @MaxLength(80, {
    message: "O serviço principal deve possuir no máximo 80 caracteres.",
  })
  professionalTitle?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @ValidateIf(
    (object: RegisterUserDto) =>
      object.initialRole === Role.PROFESSIONAL ||
      object.serviceArea !== undefined,
  )
  @IsString({ message: "A área de atendimento deve ser um texto." })
  @MinLength(2, {
    message: "A área de atendimento deve possuir pelo menos 2 caracteres.",
  })
  @MaxLength(100, {
    message: "A área de atendimento deve possuir no máximo 100 caracteres.",
  })
  serviceArea?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @ValidateIf(
    (object: RegisterUserDto) =>
      object.initialRole === Role.PROFESSIONAL ||
      object.description !== undefined,
  )
  @IsString({ message: "A descrição profissional deve ser um texto." })
  @MinLength(30, {
    message: "A descrição profissional deve possuir pelo menos 30 caracteres.",
  })
  @MaxLength(500, {
    message: "A descrição profissional deve possuir no máximo 500 caracteres.",
  })
  description?: string;
}
