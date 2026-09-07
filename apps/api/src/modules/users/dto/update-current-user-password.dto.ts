import {
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../auth/password-policy/password-policy";

export class UpdateCurrentUserPasswordDto {
  @IsString({
    message: "A senha atual deve ser um texto.",
  })
  @MinLength(1, {
    message: "Informe sua senha atual.",
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: "A senha atual deve possuir no máximo 128 caracteres.",
  })
  currentPassword!: string;

  @IsString({ message: "A nova senha deve ser um texto." })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: "A nova senha deve possuir pelo menos 12 caracteres.",
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: "A nova senha deve possuir no máximo 128 caracteres.",
  })
  newPassword!: string;
}