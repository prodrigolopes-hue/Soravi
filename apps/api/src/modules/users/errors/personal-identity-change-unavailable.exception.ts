import { ConflictException } from "@nestjs/common";

export class PersonalIdentityChangeUnavailableException extends ConflictException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_CHANGE_UNAVAILABLE", message: "A identidade pessoal nao pode ser alterada neste momento." });
  }
}
