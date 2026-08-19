import { Type, Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

import { CreateServiceRequestLocationDto } from "./create-service-request.dto";

export class UpdateServiceRequestDto {
  @IsOptional()
  @IsUUID("4", { message: "A categoria deve possuir um identificador válido." })
  categoryId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: "O título deve ser um texto." })
  @MinLength(2, { message: "O título deve possuir pelo menos 2 caracteres." })
  @MaxLength(160, {
    message: "O título deve possuir no máximo 160 caracteres.",
  })
  title?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: "A descrição deve ser um texto." })
  @MaxLength(2000, {
    message: "A descrição deve possuir no máximo 2000 caracteres.",
  })
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateServiceRequestLocationDto)
  location?: CreateServiceRequestLocationDto;
}
