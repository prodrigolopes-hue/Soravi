import { Transform } from "class-transformer";
import {
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
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string"
      ? value.trim().toLowerCase()
      : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9()\-\s]{10,24}$/, {
    message: "Informe um telefone válido.",
  })
  phone?: string;

  @IsString()
  @MinLength(12, {
    message: "A senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(128)
  @Matches(/[A-Za-zÀ-ÿ]/, {
    message: "A senha deve possuir pelo menos uma letra.",
  })
  @Matches(/[0-9]/, {
    message: "A senha deve possuir pelo menos um número.",
  })
  password!: string;

  @IsEnum(Role)
  initialRole!: InitialRegistrationRole;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  acceptedTermsVersion!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  acceptedPrivacyPolicyVersion!: string;
}