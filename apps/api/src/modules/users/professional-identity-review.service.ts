import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, IdentityVerificationDecisionSource, ProfessionalIdentityVerificationAttemptStatus } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import { Inject } from "@nestjs/common";
import { DecideProfessionalIdentityDto } from "./dto/decide-professional-identity.dto";
const URL_TTL_SECONDS = 60;

@Injectable()
export class ProfessionalIdentityReviewService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}
  async listPending() {
    return this.prisma.professionalIdentityVerificationAttempt.findMany({ where: { status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW }, select: { id: true, createdAt: true, professionalProfile: { select: { userId: true, displayName: true } } }, orderBy: { createdAt: "asc" } });
  }
  async evidence(attemptId: string) {
    const evidence = await this.prisma.identityVerificationEvidenceReference.findFirst({ where: { attemptId, kind: "DOCUMENT", attempt: { status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW } }, select: { reference: true } });
    if (!evidence) throw new NotFoundException({ code: "IDENTITY_EVIDENCE_NOT_FOUND", message: "Evidência não encontrada." });
    return { url: await this.storage.createTemporaryReadUrl(evidence.reference, URL_TTL_SECONDS), expiresInSeconds: URL_TTL_SECONDS };
  }
  async decide(adminUserId: string, attemptId: string, input: DecideProfessionalIdentityDto) {
    return this.prisma.$transaction(async (tx) => {
      const [attempt] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "professional_identity_verification_attempts" WHERE "id" = ${attemptId}::uuid AND "status" = 'UNDER_REVIEW'::"ProfessionalIdentityVerificationAttemptStatus" FOR UPDATE`);
      if (!attempt) throw new ConflictException({ code: "IDENTITY_REVIEW_NOT_AVAILABLE", message: "A tentativa não está disponível para decisão." });
      const closedAt = new Date();
      await tx.identityVerificationDecision.create({ data: { attemptId, source: IdentityVerificationDecisionSource.MANUAL, result: input.result, reasonCode: input.reasonCode, criteriaVersion: input.criteriaVersion, operatorUserId: adminUserId } });
      await tx.professionalIdentityVerificationAttempt.update({ where: { id: attemptId }, data: { status: ProfessionalIdentityVerificationAttemptStatus.CLOSED, result: input.result, closedAt } });
      return { attemptId, result: input.result, decidedAt: closedAt };
    });
  }
}
