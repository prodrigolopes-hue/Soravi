import { ConflictException } from "@nestjs/common";

export class ProfessionalProfilePhotoCandidateUnavailableException extends ConflictException {
  constructor() {
    super({
      code: "PROFESSIONAL_PROFILE_PHOTO_CANDIDATE_UNAVAILABLE",
      message: "Não foi possível concluir o processamento da foto. Tente novamente.",
    });
  }
}
