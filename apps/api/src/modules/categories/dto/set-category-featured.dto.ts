import { IsBoolean } from "class-validator";

export class SetCategoryFeaturedDto {
  @IsBoolean()
  isFeatured!: boolean;
}
