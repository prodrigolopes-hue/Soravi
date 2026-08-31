import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class PasswordResetConfirmDto {
  @IsString({ message: "O token de redefinição deve ser um texto." })
  @Length(43, 43, { message: "O token de redefinição é inválido." })
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: "O token de redefinição é inválido.",
  })
  token!: string;

  @IsString({ message: "A nova senha deve ser um texto." })
  @MinLength(12, {
    message: "A nova senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(128, {
    message: "A nova senha deve possuir no máximo 128 caracteres.",
  })
  @Matches(/[A-Za-zÀ-ÿ]/u, {
    message: "A nova senha deve possuir pelo menos uma letra.",
  })
  @Matches(/[0-9]/u, {
    message: "A nova senha deve possuir pelo menos um número.",
  })
  newPassword!: string;
}
