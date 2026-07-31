import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";

export class LoginUserDto {
  @IsEmail(
    {},
    {
      message: "Informe um e-mail válido.",
    },
  )
  @MaxLength(254, {
    message: "O e-mail deve ter no máximo 254 caracteres.",
  })
  readonly email!: string;

  @IsString({
    message: "A senha deve ser um texto.",
  })
  @IsNotEmpty({
    message: "A senha é obrigatória.",
  })
  @MaxLength(128, {
    message: "A senha deve ter no máximo 128 caracteres.",
  })
  readonly password!: string;
}