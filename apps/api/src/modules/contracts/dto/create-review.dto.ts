import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateReviewDto {
  @IsInt({ message: "INVALID_RATING" }) @Min(1, { message: "INVALID_RATING" }) @Max(5, { message: "INVALID_RATING" }) rating!: number;
  @IsOptional() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @MaxLength(1000) comment?: string;
}
