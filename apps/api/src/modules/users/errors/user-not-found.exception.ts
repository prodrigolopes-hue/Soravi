import { NotFoundException } from "@nestjs/common";

export class UserNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "USER_NOT_FOUND",
      message: "Usuário não encontrado.",
    });
  }
}