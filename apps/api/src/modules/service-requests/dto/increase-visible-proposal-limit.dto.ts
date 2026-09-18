import { IsIn } from "class-validator";

export class IncreaseVisibleProposalLimitDto {
  @IsIn([5, 10], { message: "Escolha 5 ou 10 propostas visíveis." })
  limit!: number;
}
