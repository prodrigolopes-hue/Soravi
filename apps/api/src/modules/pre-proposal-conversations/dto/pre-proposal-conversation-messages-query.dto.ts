import { IsOptional, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class PreProposalConversationMessagesQueryDto {
  @IsOptional()
  @IsUUID("4", { message: "O parâmetro before deve ser um UUID válido." })
  before?: string;

  @Type(() => Number)
  @IsOptional()
  @Min(1, { message: "O parâmetro limit deve ser no mínimo 1." })
  @Max(100, { message: "O parâmetro limit deve ser no máximo 100." })
  limit?: number = 30;
}
