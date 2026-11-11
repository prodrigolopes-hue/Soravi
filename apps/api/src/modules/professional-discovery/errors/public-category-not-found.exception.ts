import { NotFoundException } from "@nestjs/common";

export class PublicCategoryNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "PUBLIC_CATEGORY_NOT_FOUND",
      message: "Categoria não encontrada.",
    });
  }
}
