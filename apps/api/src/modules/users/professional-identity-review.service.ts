import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPersonalIdentityRecordingConfigurationFromEnvironment } from "../../config/environment.validation";
import { PrismaService } from "../../database/prisma.service";
import { Prisma, IdentityVerificationDecisionSource, ProfessionalIdentityVerificationAttemptStatus } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import { Inject } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DecideProfessionalIdentityDto } from "./dto/decide-professional-identity.dto";
const URL_TTL_SECONDS = 60;
const REASON_CODES_BY_RESULT = {
  CONFIRMED: ["DOCUMENT_CHECKED"],
  NOT_CONFIRMED: ["DATA_MISMATCH", "UNSUPPORTED_DOCUMENT", "SUSPECTED_TAMPERING", "SELFIE_DOCUMENT_MISMATCH"],
  INCONCLUSIVE: ["DOCUMENT_UNREADABLE", "DOCUMENT_INCOMPLETE", "INSUFFICIENT_INFORMATION", "SELFIE_UNREADABLE", "FACE_OBSCURED", "INADEQUATE_EVIDENCE"],
} as const;

@Injectable()
export class ProfessionalIdentityReviewService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService, private readonly config?: ConfigService) {}
  async listPending() {
    return this.prisma.professionalIdentityVerificationAttempt.findMany({ where: { status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW }, select: { id: true, createdAt: true, professionalProfile: { select: { userId: true, displayName: true } } }, orderBy: { createdAt: "asc" } });
  }
  async evidence(attemptId: string) {
    const [evidence] = await this.prisma.$queryRaw<{ reference: string; expiresAt: Date | null }[]>(Prisma.sql`SELECT "reference", "expires_at" AS "expiresAt" FROM "identity_verification_evidence_references" WHERE "attempt_id" = ${attemptId}::uuid AND "kind" = 'DOCUMENT'::"IdentityVerificationEvidenceKind" AND "superseded_at" IS NULL AND "discard_requested_at" IS NULL AND "discarded_at" IS NULL LIMIT 1`);
    if (!evidence || (evidence.expiresAt !== null && evidence.expiresAt <= new Date())) {
      throw new NotFoundException({
        code: "IDENTITY_EVIDENCE_UNAVAILABLE",
        message: "Documento não está mais disponível.",
      });
    }
    return { url: await this.storage.createTemporaryReadUrl(evidence.reference, URL_TTL_SECONDS), expiresInSeconds: URL_TTL_SECONDS };
  }
  async decide(adminUserId: string, attemptId: string, input: DecideProfessionalIdentityDto) {
    this.ensureReasonCodeMatchesResult(input);
    return this.prisma.$transaction(async (tx) => {
      const [attempt] = await tx.$queryRaw<{ id: string; requiresSelfie: boolean }[]>(Prisma.sql`SELECT "id", "requires_selfie" AS "requiresSelfie" FROM "professional_identity_verification_attempts" WHERE "id" = ${attemptId}::uuid AND "status" = 'UNDER_REVIEW'::"ProfessionalIdentityVerificationAttemptStatus" FOR UPDATE`);
      if (!attempt) throw new ConflictException({ code: "IDENTITY_REVIEW_NOT_AVAILABLE", message: "A tentativa não está disponível para decisão." });
      const activeEvidence = await tx.identityVerificationEvidenceReference.findMany({ where: { attemptId, supersededAt: null }, select: { kind: true } });
      if (!activeEvidence.some((evidence) => evidence.kind === "DOCUMENT") || (attempt.requiresSelfie && !activeEvidence.some((evidence) => evidence.kind === "SELFIE"))) throw new ConflictException({ code: "IDENTITY_REVIEW_EVIDENCE_INCOMPLETE", message: "As evidências obrigatórias não estão disponíveis para decisão." });
      const closedAt = new Date();
      await tx.identityVerificationDecision.create({ data: { attemptId, source: IdentityVerificationDecisionSource.MANUAL, result: input.result, reasonCode: input.reasonCode, criteriaVersion: input.criteriaVersion, operatorUserId: adminUserId } });
      await tx.professionalIdentityVerificationAttempt.update({ where: { id: attemptId }, data: { status: ProfessionalIdentityVerificationAttemptStatus.CLOSED, result: input.result, closedAt } });
      return { attemptId, result: input.result, decidedAt: closedAt };
    });
  }

  async selfieEvidence(adminUserId: string, attemptId: string) {
    const evidence = await this.prisma.$transaction(async (tx) => {
      const [found] = await tx.$queryRaw<{ reference: string; expiresAt: Date | null }[]>(Prisma.sql`SELECT "reference", "expires_at" AS "expiresAt" FROM "identity_verification_evidence_references" WHERE "attempt_id" = ${attemptId}::uuid AND "kind" = 'SELFIE'::"IdentityVerificationEvidenceKind" AND "superseded_at" IS NULL AND "discard_requested_at" IS NULL AND "discarded_at" IS NULL LIMIT 1`);
      if (!found || (found.expiresAt !== null && found.expiresAt <= new Date())) throw new NotFoundException({ code: "IDENTITY_SELFIE_UNAVAILABLE", message: "Selfie não está disponível." });
      await tx.identitySelfieAccessAudit.create({ data: { attemptId, operatorUserId: adminUserId, action: "ADMIN_IDENTITY_SELFIE_VIEW", accessedAt: new Date() } });
      return found;
    });
    return { url: await this.storage.createTemporaryReadUrl(evidence.reference, URL_TTL_SECONDS), expiresInSeconds: URL_TTL_SECONDS };
  }

  async markEvidenceDisposalPending(attemptId: string, kind: "DOCUMENT" | "SELFIE"): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAttempt(tx, attemptId);
      if (await this.hasActiveDisposalSuspension(tx, attemptId)) throw new ConflictException({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED", message: "O descarte está suspenso para esta tentativa." });
      const now = new Date();
      await tx.$executeRaw(Prisma.sql`UPDATE "identity_verification_evidence_references" SET "discard_requested_at" = ${now} WHERE "attempt_id" = ${attemptId}::uuid AND "kind" = ${kind}::"IdentityVerificationEvidenceKind" AND "discard_requested_at" IS NULL AND "discarded_at" IS NULL`);
    });
  }

  async markEvidenceDiscarded(attemptId: string, kind: "DOCUMENT" | "SELFIE"): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockAttempt(tx, attemptId);
      if (await this.hasActiveDisposalSuspension(tx, attemptId)) throw new ConflictException({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED", message: "O descarte está suspenso para esta tentativa." });
      const now = new Date();
      await tx.$executeRaw(Prisma.sql`UPDATE "identity_verification_evidence_references" SET "discarded_at" = ${now} WHERE "attempt_id" = ${attemptId}::uuid AND "kind" = ${kind}::"IdentityVerificationEvidenceKind" AND "discard_requested_at" IS NOT NULL AND "discarded_at" IS NULL`);
    });
  }

  async suspendEvidenceDisposal(adminUserId: string, attemptId: string, reason: string): Promise<{ attemptId: string; suspendedAt: Date }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAttempt(tx, attemptId);
      const [discarded] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "identity_verification_evidence_references" WHERE "attempt_id" = ${attemptId}::uuid AND "discarded_at" IS NOT NULL LIMIT 1`);
      if (discarded) throw new ConflictException({ code: "IDENTITY_EVIDENCE_ALREADY_DISCARDED", message: "Não é possível suspender o descarte de conteúdo já descartado." });
      if (await this.hasActiveDisposalSuspension(tx, attemptId)) throw new ConflictException({ code: "IDENTITY_EVIDENCE_DISPOSAL_ALREADY_SUSPENDED", message: "O descarte já está suspenso para esta tentativa." });
      const suspendedAt = new Date();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "identity_evidence_disposal_suspension_events" ("id", "attempt_id", "action", "reason", "operator_user_id", "created_at") VALUES (${randomUUID()}::uuid, ${attemptId}::uuid, 'APPLIED', ${reason.trim()}, ${adminUserId}::uuid, ${suspendedAt})`);
      return { attemptId, suspendedAt };
    });
  }

  async releaseEvidenceDisposalSuspension(adminUserId: string, attemptId: string, reason: string): Promise<{ attemptId: string; releasedAt: Date }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAttempt(tx, attemptId);
      if (!await this.hasActiveDisposalSuspension(tx, attemptId)) throw new ConflictException({ code: "IDENTITY_EVIDENCE_DISPOSAL_NOT_SUSPENDED", message: "O descarte não está suspenso para esta tentativa." });
      const releasedAt = new Date();
      await tx.$executeRaw(Prisma.sql`INSERT INTO "identity_evidence_disposal_suspension_events" ("id", "attempt_id", "action", "reason", "operator_user_id", "created_at") VALUES (${randomUUID()}::uuid, ${attemptId}::uuid, 'RELEASED', ${reason.trim()}, ${adminUserId}::uuid, ${releasedAt})`);
      return { attemptId, releasedAt };
    });
  }

  async details(attemptId: string) {
    const attempt = await this.prisma.professionalIdentityVerificationAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        status: true,
        result: true,
        createdAt: true,
        closedAt: true,
        requiresSelfie: true,
        evidenceReferences: {
          where: { kind: "SELFIE", supersededAt: null },
          select: { id: true },
        },
        professionalProfile: {
          select: {
            displayName: true,
            identityVerificationAttempts: {
              select: {
                id: true,
                status: true,
                result: true,
                createdAt: true,
                closedAt: true,
                requiresSelfie: true,
                decisions: {
                  select: {
                    result: true,
                    reasonCode: true,
                    createdAt: true,
                    operator: { select: { name: true } },
                  },
                },
                evidenceReferences: {
                  where: { supersededAt: null },
                  select: { kind: true },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException({ code: "IDENTITY_REVIEW_NOT_FOUND", message: "Análise não encontrada." });
    return { attempt: { id: attempt.id, status: attempt.status, result: attempt.result, createdAt: attempt.createdAt, closedAt: attempt.closedAt, requiresSelfie: attempt.requiresSelfie, hasActiveSelfie: attempt.evidenceReferences.length > 0 }, professionalName: attempt.professionalProfile.displayName, history: attempt.professionalProfile.identityVerificationAttempts.map((item) => ({ id: item.id, status: item.status, result: item.result, createdAt: item.createdAt, closedAt: item.closedAt, requiresSelfie: item.requiresSelfie, documentSubmitted: item.evidenceReferences.some((evidence) => evidence.kind === "DOCUMENT"), selfieSubmitted: item.evidenceReferences.some((evidence) => evidence.kind === "SELFIE"), decisions: item.decisions })) };
  }

  async revealCpf(adminUserId: string, attemptId: string) {
    const attempt = await this.prisma.$transaction(async (tx) => {
      const found = await tx.professionalIdentityVerificationAttempt.findUnique({ where: { id: attemptId }, select: { personalIdentity: { select: { cpfEnvelope: true } } } });
      if (!found) throw new NotFoundException({ code: "IDENTITY_REVIEW_NOT_FOUND", message: "Análise não encontrada." });
      await tx.identityCpfAccessAudit.create({ data: { attemptId, operatorUserId: adminUserId, action: "ADMIN_IDENTITY_CPF_REVEAL", accessedAt: new Date() } });
      return found;
    });
    const configuration = createPersonalIdentityRecordingConfigurationFromEnvironment({ PERSONAL_IDENTITY_RECORDING_ENABLED: this.config?.get("PERSONAL_IDENTITY_RECORDING_ENABLED"), CPF_ENCRYPTION_KEY: this.config?.get("CPF_ENCRYPTION_KEY"), CPF_ENCRYPTION_KEY_ID: this.config?.get("CPF_ENCRYPTION_KEY_ID"), CPF_HMAC_KEY: this.config?.get("CPF_HMAC_KEY"), CPF_HMAC_KEY_ID: this.config?.get("CPF_HMAC_KEY_ID") });
    if (!configuration) throw new ServiceUnavailableException({ code: "IDENTITY_CPF_REVEAL_UNAVAILABLE", message: "A consulta de CPF não está disponível." });
    return { cpf: configuration.cpfProtector.decrypt(attempt.personalIdentity.cpfEnvelope) };
  }

  private ensureReasonCodeMatchesResult(input: DecideProfessionalIdentityDto): void {
    const validCodes = REASON_CODES_BY_RESULT[input.result];
    if (!validCodes?.includes(input.reasonCode as never)) {
      throw new BadRequestException({
        code: "IDENTITY_REVIEW_REASON_CODE_INVALID",
        message: "O motivo não é válido para o resultado informado.",
      });
    }
  }

  private async lockAttempt(tx: Prisma.TransactionClient, attemptId: string): Promise<void> {
    const [attempt] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "professional_identity_verification_attempts" WHERE "id" = ${attemptId}::uuid FOR UPDATE`);
    if (!attempt) throw new NotFoundException({ code: "IDENTITY_REVIEW_NOT_FOUND", message: "Análise não encontrada." });
  }

  private async hasActiveDisposalSuspension(tx: Prisma.TransactionClient, attemptId: string): Promise<boolean> {
    const [event] = await tx.$queryRaw<{ action: string }[]>(Prisma.sql`SELECT "action" FROM "identity_evidence_disposal_suspension_events" WHERE "attempt_id" = ${attemptId}::uuid ORDER BY "created_at" DESC, "id" DESC LIMIT 1`);
    return event?.action === "APPLIED";
  }
}
