import { IsString, Length, Matches } from "class-validator";

export class EmailVerificationConfirmDto {
  @IsString({ message: "O token de confirmacao de e-mail deve ser um texto." })
  @Length(43, 43, { message: "O token de confirmacao de e-mail e invalido." })
  @Matches(/^[A-Za-z0-9_-]+$/u, {
    message: "O token de confirmacao de e-mail e invalido.",
  })
  token!: string;
}
