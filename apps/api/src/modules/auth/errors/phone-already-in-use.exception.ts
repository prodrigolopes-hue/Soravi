import { ConflictException } from "@nestjs/common";

export class PhoneAlreadyInUseException extends ConflictException {
  constructor() {
    super({
      code: "REGISTRATION_CONTACT_CONFLICT",
      message:
        "Não foi possível usar os dados de contato informados. Se você já possui uma conta, entre para continuar ou utilize outros dados.",
    });
  }
}
