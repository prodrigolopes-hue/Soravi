import { ArrayMaxSize, ArrayUnique, IsArray, IsString, IsUUID, Length } from "class-validator";

export class EditAdminCategoryDto {
  @IsString()
  @Length(1, 120)
  expectedName!: string;

  @IsString()
  @Length(1, 120)
  name!: string;
}

export class SplitAdminCategoryDto {
  @IsString()
  @Length(1, 120)
  expectedName!: string;

  @IsString()
  @Length(1, 120)
  originalName!: string;

  @IsString()
  @Length(1, 120)
  newName!: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  professionalProfileIds!: string[];
}
