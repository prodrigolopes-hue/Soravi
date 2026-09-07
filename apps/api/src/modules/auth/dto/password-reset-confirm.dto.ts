import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../password-policy/password-policy";

export class PasswordResetConfirmDto {
  @IsString({ message: "O token de redefinição deve ser um texto." })
  @Length(43, 43, { message: "O token de redefinição é inválido." })
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: "O token de redefinição é inválido.",
  })
  token!: string;

  @IsString({ message: "A nova senha deve ser um texto." })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: "A nova senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: "A nova senha deve possuir no máximo 128 caracteres.",
  })
  newPassword!: string;
}
