import { ConflictException } from "@nestjs/common";

export class PublicCategorySuggestionNotPendingException extends ConflictException {
  constructor() {
    super({
      code: "PUBLIC_CATEGORY_SUGGESTION_NOT_PENDING",
      message: "Apenas sugestões públicas pendentes podem ser moderadas.",
    });
  }
}
