import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateMessageDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "A mensagem deve ser um texto." })
  @IsNotEmpty({ message: "A mensagem é obrigatória." })
  @MaxLength(4000, {
    message: "A mensagem deve ter no máximo 4000 caracteres.",
  })
  content!: string;
}
