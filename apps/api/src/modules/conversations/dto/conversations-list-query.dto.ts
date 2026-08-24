import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ConversationsListQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro page deve ser um inteiro." })
  @Min(1, { message: "O parâmetro page deve ser no mínimo 1." })
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: "O parâmetro limit deve ser um inteiro." })
  @Min(1, { message: "O parâmetro limit deve ser no mínimo 1." })
  @Max(50, { message: "O parâmetro limit deve ser no máximo 50." })
  limit?: number = 20;
}
