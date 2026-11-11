import { ConflictException } from "@nestjs/common";

export class PersonalIdentityKeyUnavailableException extends ConflictException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_KEY_UNAVAILABLE", message: "A identidade pessoal nao pode ser processada neste momento." });
  }
}
