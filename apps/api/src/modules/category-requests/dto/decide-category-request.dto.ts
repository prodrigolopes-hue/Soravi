import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class DecideCategoryRequestDto {
  @IsIn(["CREATE", "ASSOCIATE", "REJECT"])
  decision!: "CREATE" | "ASSOCIATE" | "REJECT";

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
