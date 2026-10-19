import { ConflictException } from "@nestjs/common";

/** Deliberately does not reveal whether another account owns the CPF. */
export class PersonalIdentityCpfUnavailableException extends ConflictException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_CPF_UNAVAILABLE", message: "Nao foi possivel usar os dados pessoais informados." });
  }
}
