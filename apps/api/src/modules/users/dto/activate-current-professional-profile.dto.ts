import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

class CategoryRequestDto {
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  suggestedName!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class ActivateCurrentProfessionalProfileDto {
  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  professionalTitle!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  serviceArea!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === "string" ? value.trim() : value)
  @IsString()
  @MinLength(30)
  @MaxLength(500)
  bio!: string;

  @Transform(({ value }: { value: unknown }) => Array.isArray(value) ? value.map((item) => typeof item === "string" ? item.trim() : item) : value)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  categorySlugs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CategoryRequestDto)
  categoryRequests?: CategoryRequestDto[];
}
