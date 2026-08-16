import { NotFoundException } from "@nestjs/common";

export class CustomerProfileNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "CUSTOMER_PROFILE_NOT_FOUND",
      message: "Perfil de cliente não encontrado para o usuário autenticado.",
    });
  }
}