import { ConflictException } from "@nestjs/common";

export class ProfessionalVerificationStatusTransitionNotAllowedException extends ConflictException {
  constructor() {
    super({
      code: "PROFESSIONAL_VERIFICATION_STATUS_TRANSITION_NOT_ALLOWED",
      message: "O perfil profissional n\u00e3o pode ser enviado para an\u00e1lise no estado atual.",
    });
  }
}
