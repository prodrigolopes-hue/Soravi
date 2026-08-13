import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UsersAdminProfessionalsQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro page deve ser um inteiro." })
  @Min(1, { message: "O parâmetro page deve ser no mínimo 1." })
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro pageSize deve ser um inteiro." })
  @Min(1, { message: "O parâmetro pageSize deve ser no mínimo 1." })
  @Max(100, {
    message: "O parâmetro pageSize deve ser no máximo 100.",
  })
  pageSize?: number = 20;
}
