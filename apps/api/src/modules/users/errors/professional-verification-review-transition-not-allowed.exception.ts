import { ConflictException } from "@nestjs/common";

export class ProfessionalVerificationReviewTransitionNotAllowedException extends ConflictException {
  constructor() {
    super({ code: "PROFESSIONAL_VERIFICATION_REVIEW_TRANSITION_NOT_ALLOWED", message: "O perfil profissional nao esta pendente de analise." });
  }
}
