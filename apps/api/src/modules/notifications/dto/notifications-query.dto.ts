import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class NotificationsQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro page deve ser um inteiro." })
  @Min(1, { message: "O parâmetro page deve ser no mínimo 1." })
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro limit deve ser um inteiro." })
  @Min(1, { message: "O parâmetro limit deve ser no mínimo 1." })
  @Max(100, { message: "O parâmetro limit deve ser no máximo 100." })
  limit?: number = 20;
}
