import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString, MaxLength, MinLength } from "class-validator";

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
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  categorySlugs!: string[];
}
