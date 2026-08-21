import { IsUUID } from "class-validator";

export class MarkConversationReadDto {
  @IsUUID("4", { message: "A mensagem informada é inválida." })
  lastReadMessageId!: string;
}