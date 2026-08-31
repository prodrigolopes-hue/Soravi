import { Transform } from "class-transformer";
import { IsEmail, MaxLength } from "class-validator";

export class PasswordResetRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: "Informe um e-mail válido." })
  @MaxLength(254, {
    message: "O e-mail deve possuir no máximo 254 caracteres.",
  })
  email!: string;
}
