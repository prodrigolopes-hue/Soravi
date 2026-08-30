import { Transform } from "class-transformer";
import {
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { IsBrazilianPhone } from "../../../common/phone/is-brazilian-phone.decorator";

export class UpdateCurrentUserPhoneDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O telefone deve ser um texto." })
  @IsBrazilianPhone()
  phone!: string;

  @IsString({
    message: "A senha atual deve ser um texto.",
  })
  @MinLength(1, {
    message: "Informe sua senha atual.",
  })
  @MaxLength(128, {
    message: "A senha atual deve possuir no máximo 128 caracteres.",
  })
  currentPassword!: string;
}
