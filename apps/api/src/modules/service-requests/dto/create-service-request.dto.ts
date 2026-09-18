import { Type, Transform } from "class-transformer";
import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
  IsIn,
} from "class-validator";

export class CreateServiceRequestLocationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: "O país deve ser um texto." })
  @Length(2, 2, { message: "O país deve possuir exatamente 2 caracteres." })
  country!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: "O estado deve ser um texto." })
  @Length(2, 2, { message: "O estado deve possuir exatamente 2 caracteres." })
  state!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "A cidade deve ser um texto." })
  @MinLength(2, { message: "A cidade deve possuir pelo menos 2 caracteres." })
  @MaxLength(120, { message: "A cidade deve possuir no máximo 120 caracteres." })
  city!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O bairro deve ser um texto." })
  @MinLength(1, { message: "O bairro é obrigatório." })
  @MaxLength(120, { message: "O bairro deve possuir no máximo 120 caracteres." })
  neighborhood!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O CEP deve ser um texto." })
  @MinLength(1, { message: "O CEP é obrigatório." })
  @MaxLength(16, { message: "O CEP deve possuir no máximo 16 caracteres." })
  postalCode!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O endereço deve ser um texto." })
  @MinLength(1, { message: "O endereço é obrigatório." })
  @MaxLength(255, { message: "O endereço deve possuir no máximo 255 caracteres." })
  addressLine!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O número deve ser um texto." })
  @MinLength(1, { message: "O número é obrigatório." })
  @MaxLength(32, { message: "O número deve possuir no máximo 32 caracteres." })
  addressNumber!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: "O complemento deve ser um texto." })
  @MaxLength(255, { message: "O complemento deve possuir no máximo 255 caracteres." })
  addressComplement?: string;
}

export class CreateServiceRequestDto {
  @IsOptional()
  @IsIn([3, 5, 10], { message: "Escolha 3, 5 ou 10 propostas visíveis." })
  visibleProposalLimit?: number;
  @IsUUID("4", { message: "A categoria deve possuir um identificador válido." })
  categoryId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString({ message: "O título deve ser um texto." })
  @MinLength(2, { message: "O título deve possuir pelo menos 2 caracteres." })
  @MaxLength(160, { message: "O título deve possuir no máximo 160 caracteres." })
  title!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: "A descrição deve ser um texto." })
  @MaxLength(2000, { message: "A descrição deve possuir no máximo 2000 caracteres." })
  description?: string;

  @IsDefined({ message: "A localização é obrigatória." })
  @ValidateNested()
  @Type(() => CreateServiceRequestLocationDto)
  location!: CreateServiceRequestLocationDto;
}
