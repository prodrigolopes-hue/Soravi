import { ConflictException } from "@nestjs/common";

export class EmailAlreadyInUseException extends ConflictException {
  constructor() {
    super({
      code: "EMAIL_ALREADY_IN_USE",
      message: "Já existe uma conta associada a este e-mail.",
    });
  }
}