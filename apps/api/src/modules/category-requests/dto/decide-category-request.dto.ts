import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class CreateResolvedCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;
}

export class ResolvedCategoryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateResolvedCategoryDto)
  create?: CreateResolvedCategoryDto;
}

export class DecideCategoryRequestDto {
  // CREATE and ASSOCIATE remain accepted for one-category legacy clients.
  @IsIn(["CREATE", "ASSOCIATE", "REJECT", "RESOLVE"])
  decision!: "CREATE" | "ASSOCIATE" | "REJECT" | "RESOLVE";

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ResolvedCategoryDto)
  categories?: ResolvedCategoryDto[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}
