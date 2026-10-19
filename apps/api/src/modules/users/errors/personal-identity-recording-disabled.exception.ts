import { ServiceUnavailableException } from "@nestjs/common";

export class PersonalIdentityRecordingDisabledException extends ServiceUnavailableException {
  constructor() {
    super({ code: "PERSONAL_IDENTITY_RECORDING_UNAVAILABLE", message: "O registro de identidade pessoal esta indisponivel." });
  }
}
