import { NotFoundException } from "@nestjs/common";

export class PublicCategorySuggestionNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PUBLIC_CATEGORY_SUGGESTION_NOT_FOUND",
      message: "Sugestão pública de categoria não encontrada.",
    });
  }
}
