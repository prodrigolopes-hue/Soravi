import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { CurrentProfessionalProfileNotFoundException } from "./errors/current-professional-profile-not-found.exception";

export type ProfessionalIdentityVerificationStatusResult = {
  status: "NOT_STARTED" | "UNDER_REVIEW" | "CLOSED";
  result: "PENDING" | "CONFIRMED" | "NOT_CONFIRMED" | "INCONCLUSIVE";
  requiresSelfie: boolean;
  documentSubmitted: boolean;
  selfieSubmitted: boolean;
};

@Injectable()
export class ProfessionalIdentityVerificationStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(userId: string): Promise<ProfessionalIdentityVerificationStatusResult> {
    const profile = await this.prisma.professionalProfile.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: {
        identityVerificationAttempts: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            status: true,
            result: true,
            requiresSelfie: true,
            evidenceReferences: {
              where: { supersededAt: null },
              select: { kind: true },
            },
          },
        },
      },
    });
    if (!profile) throw new CurrentProfessionalProfileNotFoundException();
    const attempt = profile.identityVerificationAttempts[0];
    if (!attempt || attempt.status === "AWAITING_EVIDENCE" || attempt.status === "CANCELLED") {
      return { status: "NOT_STARTED", result: "PENDING", requiresSelfie: false, documentSubmitted: false, selfieSubmitted: false };
    }
    return { status: attempt.status, result: attempt.result, requiresSelfie: attempt.requiresSelfie, documentSubmitted: attempt.evidenceReferences.some((evidence) => evidence.kind === "DOCUMENT"), selfieSubmitted: attempt.evidenceReferences.some((evidence) => evidence.kind === "SELFIE") };
  }
}
