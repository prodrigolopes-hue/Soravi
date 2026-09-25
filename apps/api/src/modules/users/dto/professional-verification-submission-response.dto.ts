import { ProfessionalVerificationStatus } from "../../../generated/prisma/client";

export class ProfessionalVerificationSubmissionResponseDto {
  verificationStatus: ProfessionalVerificationStatus;

  constructor(verificationStatus: ProfessionalVerificationStatus) {
    this.verificationStatus = verificationStatus;
  }
}
