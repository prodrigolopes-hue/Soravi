import { ConflictException } from "@nestjs/common";

export class PhoneAlreadyInUseException extends ConflictException {
  constructor() {
    super({
      code: "PHONE_ALREADY_IN_USE",
      message: "Este telefone já está sendo utilizado.",
    });
  }
}