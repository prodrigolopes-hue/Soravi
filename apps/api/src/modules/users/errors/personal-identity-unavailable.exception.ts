import { ForbiddenException } from "@nestjs/common";

export class PersonalIdentityUnavailableException extends ForbiddenException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_UNAVAILABLE", message: "A identidade pessoal nao pode ser registrada para esta conta." });
  }
}
