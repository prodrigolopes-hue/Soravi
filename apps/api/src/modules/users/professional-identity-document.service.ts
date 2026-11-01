import { ConflictException, Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, ProfessionalIdentityVerificationAttemptStatus } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import { CurrentProfessionalProfileNotFoundException } from "./errors/current-professional-profile-not-found.exception";
import { processProfessionalIdentityDocument, type ProcessProfessionalIdentityDocumentInput } from "./professional-identity-document-image";

const OBJECT_KEY_PREFIX = "private/professional-identity-documents";
const CANDIDATE_DELAY_MS = 60 * 60 * 1000;

@Injectable()
export class ProfessionalIdentityDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly config?: ConfigService,
  ) {}

  async submitCurrent(userId: string, input: ProcessProfessionalIdentityDocumentInput): Promise<void> {
    return this.submitCurrentEvidence(userId, "DOCUMENT", input);
  }

  async submitSelfie(userId: string, input: ProcessProfessionalIdentityDocumentInput): Promise<void> {
    if (!this.isSelfieEnabled()) {
      const profile = await this.prisma.professionalProfile.findFirst({
        where: { userId, deletedAt: null },
        select: { identityVerificationAttempts: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { status: true, requiresSelfie: true } } },
      });
      const attempt = profile?.identityVerificationAttempts[0];
      if (!attempt || attempt.status !== ProfessionalIdentityVerificationAttemptStatus.AWAITING_EVIDENCE || !attempt.requiresSelfie) {
        throw new ConflictException({ code: "PROFESSIONAL_IDENTITY_SELFIE_UNAVAILABLE", message: "O envio de selfie não está disponível para esta tentativa." });
      }
    }
    return this.submitCurrentEvidence(userId, "SELFIE", input);
  }

  isSelfieEnabled(): boolean {
    return this.config?.get("PROFESSIONAL_IDENTITY_SELFIE_ENABLED") === "true";
  }

  private async submitCurrentEvidence(userId: string, kind: "DOCUMENT" | "SELFIE", input: ProcessProfessionalIdentityDocumentInput): Promise<void> {
    const document = await processProfessionalIdentityDocument(input);
    const objectKey = `${OBJECT_KEY_PREFIX}/${randomUUID()}.webp`;
    await this.createCleanupCandidate(objectKey);
    await this.storage.upload({ objectKey, body: document.buffer, contentType: document.mimeType, sizeBytes: document.sizeBytes });

    try {
      await this.prisma.$transaction(async (transaction) => {
        const [candidate] = await transaction.$queryRaw<{ status: string }[]>(Prisma.sql`
          SELECT "status" FROM "identity_document_cleanup_tasks"
          WHERE "object_key" = ${objectKey} FOR UPDATE
        `);
        if (!candidate || candidate.status !== "PENDING") {
          throw new ConflictException({
            code: "PROFESSIONAL_IDENTITY_DOCUMENT_CANDIDATE_UNAVAILABLE",
            message: "Não foi possível concluir o envio do documento.",
          });
        }
        const profile = await this.lockProfile(transaction, userId);
        if (!profile) throw new CurrentProfessionalProfileNotFoundException();

        const identity = await transaction.personalIdentity.findUnique({
          where: { userId }, select: { id: true },
        });
        if (!identity) {
          throw new UnprocessableEntityException({
            code: "PERSONAL_IDENTITY_REQUIRED",
            message: "Cadastre seu CPF antes de enviar o documento de identidade.",
          });
        }

        const latestAttempt = await transaction.professionalIdentityVerificationAttempt.findFirst({
          where: { professionalProfileId: profile.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, status: true, result: true, requiresSelfie: true },
        });
        if (latestAttempt?.status === ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW) {
          throw new ConflictException({
            code: "PROFESSIONAL_IDENTITY_DOCUMENT_ALREADY_SUBMITTED",
            message: "Seu documento já está em análise.",
          });
        }
        if (latestAttempt?.status === ProfessionalIdentityVerificationAttemptStatus.CLOSED && latestAttempt.result === "CONFIRMED") {
          throw new ConflictException({ code: "PROFESSIONAL_IDENTITY_ALREADY_CONFIRMED", message: "Sua identidade já foi confirmada." });
        }

        const selfieEnabled = this.isSelfieEnabled();
        const attempt = latestAttempt?.status === ProfessionalIdentityVerificationAttemptStatus.AWAITING_EVIDENCE
          ? latestAttempt
          : await transaction.professionalIdentityVerificationAttempt.create({
          data: { professionalProfileId: profile.id, personalIdentityId: identity.id, requiresSelfie: selfieEnabled },
          select: { id: true, requiresSelfie: true },
        });
        if (kind === "SELFIE" && !attempt.requiresSelfie) {
          throw new ConflictException({ code: "PROFESSIONAL_IDENTITY_SELFIE_NOT_REQUIRED", message: "Esta tentativa não aceita selfie." });
        }
        const now = new Date();
        await transaction.identityVerificationEvidenceReference.updateMany({
          where: { attemptId: attempt.id, kind, supersededAt: null },
          data: { supersededAt: now },
        });
        await transaction.identityVerificationEvidenceReference.create({
          data: { attemptId: attempt.id, kind, reference: objectKey },
        });
        const activeEvidence = await transaction.identityVerificationEvidenceReference.findMany({ where: { attemptId: attempt.id, supersededAt: null }, select: { kind: true } });
        const hasDocument = activeEvidence.some((evidence) => evidence.kind === "DOCUMENT");
        const hasSelfie = activeEvidence.some((evidence) => evidence.kind === "SELFIE");
        if (hasDocument && (!attempt.requiresSelfie || hasSelfie)) await transaction.professionalIdentityVerificationAttempt.update({ where: { id: attempt.id }, data: { status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW } });
        await transaction.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${objectKey}`);
      });
    } catch (error) {
      await this.storage.delete(objectKey).then(
        () => this.prisma.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${objectKey}`),
        () => undefined,
      ).catch(() => undefined);
      throw error;
    }
  }

  async processCleanupBatch(now = new Date(), limit = 25): Promise<void> {
    const tasks = await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.$queryRaw<{ id: string; objectKey: string }[]>(Prisma.sql`
      SELECT "id", "object_key" AS "objectKey" FROM "identity_document_cleanup_tasks"
      WHERE (
        "status" IN ('PENDING'::"IdentityDocumentCleanupStatus", 'COMPLETED'::"IdentityDocumentCleanupStatus")
        AND "next_attempt_at" <= ${now}
      ) OR (
        "status" = 'PROCESSING'::"IdentityDocumentCleanupStatus"
        AND "lease_expires_at" <= ${now}
      )
      ORDER BY "next_attempt_at" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT ${Math.max(1, Math.min(limit, 25))}
    `);
      for (const task of claimed) {
        await transaction.$executeRaw(Prisma.sql`UPDATE "identity_document_cleanup_tasks" SET "status" = 'PROCESSING'::"IdentityDocumentCleanupStatus", "lease_expires_at" = ${new Date(now.getTime() + 5 * 60 * 1000)}, "updated_at" = ${now} WHERE "id" = ${task.id}::uuid`);
      }
      return claimed;
    });
    for (const task of tasks) {
      const referenced = await this.prisma.identityVerificationEvidenceReference.findFirst({ where: { reference: task.objectKey }, select: { id: true } });
      if (referenced) { await this.prisma.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "id" = ${task.id}::uuid`); continue; }
      try {
        await this.storage.delete(task.objectKey);
        await this.prisma.$executeRaw(Prisma.sql`UPDATE "identity_document_cleanup_tasks" SET "status" = 'COMPLETED'::"IdentityDocumentCleanupStatus", "next_attempt_at" = ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}, "lease_expires_at" = NULL, "completed_at" = ${now}, "updated_at" = ${now} WHERE "id" = ${task.id}::uuid`);
      } catch {
        await this.prisma.$executeRaw(Prisma.sql`UPDATE "identity_document_cleanup_tasks" SET "status" = 'PENDING'::"IdentityDocumentCleanupStatus", "attempt_count" = "attempt_count" + 1, "next_attempt_at" = ${new Date(now.getTime() + 60_000)}, "lease_expires_at" = NULL, "updated_at" = ${now} WHERE "id" = ${task.id}::uuid`);
      }
    }
  }

  private async createCleanupCandidate(objectKey: string): Promise<void> {
    const now = new Date();
    await this.prisma.$executeRaw(Prisma.sql`INSERT INTO "identity_document_cleanup_tasks" ("id", "object_key", "status", "attempt_count", "next_attempt_at", "created_at", "updated_at") VALUES (${randomUUID()}::uuid, ${objectKey}, 'PENDING'::"IdentityDocumentCleanupStatus", 0, ${new Date(now.getTime() + CANDIDATE_DELAY_MS)}, ${now}, ${now})`);
  }

  private async lockProfile(transaction: Prisma.TransactionClient, userId: string): Promise<{ id: string } | null> {
    const [profile] = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "professional_profiles"
      WHERE "user_id" = ${userId}::uuid AND "deleted_at" IS NULL
      FOR UPDATE
    `);
    return profile ?? null;
  }
}
