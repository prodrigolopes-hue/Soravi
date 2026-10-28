import { NotFoundException } from "@nestjs/common";

export class PreProposalConversationNotFoundException extends NotFoundException {
  constructor() {
    super({ code: "PRE_PROPOSAL_CONVERSATION_NOT_FOUND", message: "Conversa não encontrada." });
  }
}
