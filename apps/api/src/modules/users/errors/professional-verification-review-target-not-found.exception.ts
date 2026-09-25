import { NotFoundException } from "@nestjs/common";

export class ProfessionalVerificationReviewTargetNotFoundException extends NotFoundException {
  constructor() {
    super({ code: "PROFESSIONAL_VERIFICATION_REVIEW_TARGET_NOT_FOUND", message: "Profissional nao encontrado." });
  }
}
