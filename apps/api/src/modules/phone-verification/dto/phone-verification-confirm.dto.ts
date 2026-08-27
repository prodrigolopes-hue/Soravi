import { IsString, Length, Matches } from "class-validator";

export class PhoneVerificationConfirmDto {
  @IsString({ message: "O código deve ser um texto." })
  @Length(6, 6, { message: "O código deve possuir exatamente 6 dígitos." })
  @Matches(/^\d{6}$/, { message: "O código deve possuir somente dígitos." })
  code!: string;
}
