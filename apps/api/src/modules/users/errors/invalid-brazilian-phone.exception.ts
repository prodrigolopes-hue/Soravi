import { BadRequestException } from "@nestjs/common";

export class InvalidBrazilianPhoneException extends BadRequestException {
  constructor() {
    super({
      code: "INVALID_BRAZILIAN_PHONE",
      message: "Informe um telefone brasileiro válido com DDD.",
    });
  }
}
