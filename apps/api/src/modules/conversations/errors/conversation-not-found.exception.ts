import { NotFoundException } from "@nestjs/common";

export class ConversationNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "CONVERSATION_NOT_FOUND",
      message: "Conversa não encontrada.",
    });
  }
}
