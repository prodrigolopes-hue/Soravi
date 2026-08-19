import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelServiceRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: "O motivo deve ser um texto." })
  @MaxLength(1000, {
    message: "O motivo deve possuir no máximo 1000 caracteres.",
  })
  reason?: string;
}
