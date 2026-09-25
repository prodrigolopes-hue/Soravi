import { UnprocessableEntityException } from "@nestjs/common";

export type ProfessionalVerificationSubmissionIneligibilityReason =
  | "DISPLAY_NAME_MISSING"
  | "PHONE_MISSING"
  | "PHONE_NOT_VERIFIED"
  | "ACTIVE_CATEGORY_MISSING";

const messages: Record<ProfessionalVerificationSubmissionIneligibilityReason, string> = {
  DISPLAY_NAME_MISSING: "Informe um nome de exibi\u00e7\u00e3o antes de enviar o perfil para an\u00e1lise.",
  PHONE_MISSING: "Informe um telefone antes de enviar o perfil para an\u00e1lise.",
  PHONE_NOT_VERIFIED: "Verifique seu telefone antes de enviar o perfil para an\u00e1lise.",
  ACTIVE_CATEGORY_MISSING: "Selecione ao menos uma categoria ativa antes de enviar o perfil para an\u00e1lise.",
};

export class ProfessionalVerificationSubmissionNotEligibleException extends UnprocessableEntityException {
  constructor(reason: ProfessionalVerificationSubmissionIneligibilityReason) {
    super({
      code: `PROFESSIONAL_VERIFICATION_${reason}`,
      message: messages[reason],
    });
  }
}
