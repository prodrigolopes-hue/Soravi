import { InternalServerErrorException } from "@nestjs/common";

/** Prevents driver errors from exposing operation values. */
export class PersonalIdentityPersistenceException extends InternalServerErrorException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_PERSISTENCE_FAILED", message: "Nao foi possivel registrar a identidade pessoal." });
  }
}
