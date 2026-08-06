import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import {
  LaunchInterestSource,
  LaunchInterestType,
} from "../../../generated/prisma/client";

const PHONE_PATTERN = /^\+?[0-9()\-\s]{10,32}$/;

export class CreateLaunchInterestDto {
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

  @IsEnum(LaunchInterestType, {
    message: "O tipo de audiência informado é inválido.",
  })
  audienceType!: LaunchInterestType;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({
    message: "A cidade deve ser um texto.",
  })
  @MinLength(2, {
    message: "A cidade deve possuir pelo menos 2 caracteres.",
  })
  @MaxLength(120, {
    message: "A cidade deve possuir no máximo 120 caracteres.",
  })
  city!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim().toUpperCase();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "A UF deve ser um texto.",
  })
  @Length(2, 2, {
    message: "A UF deve possuir exatamente 2 caracteres.",
  })
  @Matches(/^[A-Z]{2}$/, {
    message: "A UF deve conter apenas letras maiúsculas.",
  })
  state?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "O interesse de serviço deve ser um texto.",
  })
  @MaxLength(500, {
    message: "O interesse de serviço deve possuir no máximo 500 caracteres.",
  })
  serviceInterest?: string | null;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString({
    message: "O interesse por categoria profissional deve ser um texto.",
  })
  @MaxLength(500, {
    message:
      "O interesse por categoria profissional deve possuir no máximo 500 caracteres.",
  })
  professionalCategoryInterest?: string | null;

  @IsOptional()
  @IsEnum(LaunchInterestSource, {
    message: "A origem do interesse informada é inválida.",
  })
  source?: LaunchInterestSource;

  @IsBoolean({
    message: "O aceite do aviso de privacidade deve ser booleano.",
  })
  @Equals(true, {
    message: "O aviso de privacidade deve ser aceito.",
  })
  privacyNoticeAccepted!: boolean;

  @IsOptional()
  @IsBoolean({
    message: "O consentimento de marketing deve ser booleano.",
  })
  marketingConsent?: boolean;
}
