import { ConflictException } from "@nestjs/common";

export class CategoryRequestAlreadyPendingException extends ConflictException {
  constructor() {
    super({
      code: "CATEGORY_REQUEST_ALREADY_PENDING",
      message:
        "Já existe uma solicitação de categoria pendente com este nome sugerido.",
    });
  }
}
