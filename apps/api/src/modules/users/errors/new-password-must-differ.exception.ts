import { BadRequestException } from "@nestjs/common";

export class NewPasswordMustDifferException extends BadRequestException {
  constructor() {
    super({
      code: "NEW_PASSWORD_MUST_DIFFER",
      message: "A nova senha deve ser diferente da senha atual.",
    });
  }
}