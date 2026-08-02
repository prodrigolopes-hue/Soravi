import {
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class RefreshTokenDto {
  @IsString({
    message: "Informe um refresh token válido.",
  })
  @MinLength(32, {
    message: "Informe um refresh token válido.",
  })
  @MaxLength(512, {
    message: "Informe um refresh token válido.",
  })
  refreshToken!: string;
}