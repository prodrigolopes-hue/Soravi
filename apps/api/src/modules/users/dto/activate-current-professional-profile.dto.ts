import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

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
  categoryRequests?: Array<{ suggestedName: string; description?: string }>;
}
