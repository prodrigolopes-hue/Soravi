import { UnprocessableEntityException } from "@nestjs/common";

export type ProfessionalVerificationSubmissionIneligibilityReason =
  | "DISPLAY_NAME_MISSING"
  | "PHONE_MISSING"
  | "PHONE_NOT_VERIFIED"
  | "ACTIVE_CATEGORY_MISSING"
  | "PROFESSIONAL_TITLE_MISSING"
  | "SERVICE_AREA_MISSING"
  | "BIO_TOO_SHORT";

const messages: Record<ProfessionalVerificationSubmissionIneligibilityReason, string> = {
  PROFESSIONAL_TITLE_MISSING: "Informe o serviço principal antes de reenviar o perfil.",
  SERVICE_AREA_MISSING: "Informe a área de atendimento antes de reenviar o perfil.",
  BIO_TOO_SHORT: "Informe uma descrição profissional de pelo menos 30 caracteres antes de reenviar o perfil.",
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
