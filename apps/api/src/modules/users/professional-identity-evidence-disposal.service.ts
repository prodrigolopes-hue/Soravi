import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";

const POLICY_VERSION = "identity-media-v1";
const BATCH_LIMIT = 25;
const LEASE_MS = 5 * 60 * 1000;
const RETRY_BASE_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

type Candidate = { evidenceId: string; attemptId: string; objectKey: string; reason: string; eligibleAt: Date };
type Claim = { id: string; evidenceId: string; objectKey: string; attemptCount: number; leaseExpiresAt: Date };

@Injectable()
export class ProfessionalIdentityEvidenceDisposalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly config?: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config?.get("IDENTITY_EVIDENCE_DISPOSAL_ENABLED") === "true";
  }

  async processBatch(now = new Date(), limit = BATCH_LIMIT): Promise<void> {
    if (!this.isEnabled()) return;
    const boundedLimit = Math.max(1, Math.min(limit, BATCH_LIMIT));
    await this.expireIncompleteAttempts(now, boundedLimit);
    await this.scheduleEligibleEvidence(now, boundedLimit);
    const claims = await this.prisma.$transaction((tx) => this.claimTasks(tx, now, boundedLimit));
    for (const claim of claims) await this.deleteClaimedEvidence(claim, now);
  }

  private async expireIncompleteAttempts(now: Date, limit: number): Promise<void> {
    const candidates = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT a."id"
      FROM "professional_identity_verification_attempts" a
      WHERE a."status" = 'AWAITING_EVIDENCE'::"ProfessionalIdentityVerificationAttemptStatus"
        AND (SELECT MAX(e."created_at") FROM "identity_verification_evidence_references" e WHERE e."attempt_id" = a."id") <= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
      ORDER BY a."created_at" ASC, a."id" ASC
      LIMIT ${limit}
    `);
    for (const candidate of candidates) {
      await this.prisma.$transaction(async (tx) => {
        const [attempt] = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT a."id"
          FROM "professional_profiles" p
          JOIN "professional_identity_verification_attempts" a ON a."professional_profile_id" = p."id"
          WHERE a."id" = ${candidate.id}::uuid
            AND a."status" = 'AWAITING_EVIDENCE'::"ProfessionalIdentityVerificationAttemptStatus"
          FOR UPDATE OF p, a
        `);
        if (!attempt) return;
        const [lastEvidence] = await tx.$queryRaw<{ createdAt: Date | null }[]>(Prisma.sql`
          SELECT MAX("created_at") AS "createdAt" FROM "identity_verification_evidence_references" WHERE "attempt_id" = ${candidate.id}::uuid
        `);
        if (!lastEvidence?.createdAt || lastEvidence.createdAt > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return;
        await tx.$executeRaw(Prisma.sql`
          UPDATE "professional_identity_verification_attempts"
          SET "status" = 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus", "closed_at" = ${now}
          WHERE "id" = ${candidate.id}::uuid AND "status" = 'AWAITING_EVIDENCE'::"ProfessionalIdentityVerificationAttemptStatus"
        `);
      });
    }
  }

  private async scheduleEligibleEvidence(now: Date, limit: number): Promise<void> {
    const candidates = await this.prisma.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT e."id" AS "evidenceId", e."attempt_id" AS "attemptId", e."reference" AS "objectKey",
        CASE
          WHEN e."superseded_at" IS NOT NULL THEN 'SUPERSEDED'
          WHEN a."status" = 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus" THEN 'INCOMPLETE_ATTEMPT'
          ELSE 'CLOSED_ATTEMPT'
        END AS "reason",
        CASE
          WHEN e."superseded_at" IS NOT NULL THEN e."superseded_at" + INTERVAL '7 days'
          WHEN a."status" = 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus" THEN (SELECT MAX(x."created_at") FROM "identity_verification_evidence_references" x WHERE x."attempt_id" = a."id") + INTERVAL '30 days'
          ELSE (SELECT MAX(d."created_at") FROM "identity_verification_decisions" d WHERE d."attempt_id" = a."id") + INTERVAL '90 days'
        END AS "eligibleAt"
      FROM "identity_verification_evidence_references" e
      JOIN "professional_identity_verification_attempts" a ON a."id" = e."attempt_id"
      LEFT JOIN LATERAL (
        SELECT s."action" FROM "identity_evidence_disposal_suspension_events" s
        WHERE s."attempt_id" = a."id" ORDER BY s."created_at" DESC, s."id" DESC LIMIT 1
      ) suspension ON true
      WHERE e."kind" IN ('DOCUMENT'::"IdentityVerificationEvidenceKind", 'SELFIE'::"IdentityVerificationEvidenceKind")
        AND e."reference" IS NOT NULL AND e."discard_requested_at" IS NULL AND e."discarded_at" IS NULL
        AND a."status" <> 'UNDER_REVIEW'::"ProfessionalIdentityVerificationAttemptStatus"
        AND COALESCE(suspension."action", 'RELEASED') <> 'APPLIED'
        AND (
          (e."superseded_at" IS NOT NULL AND e."superseded_at" <= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)})
          OR (a."status" = 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus" AND (SELECT MAX(x."created_at") FROM "identity_verification_evidence_references" x WHERE x."attempt_id" = a."id") <= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)})
          OR (a."status" = 'CLOSED'::"ProfessionalIdentityVerificationAttemptStatus" AND (SELECT MAX(d."created_at") FROM "identity_verification_decisions" d WHERE d."attempt_id" = a."id") <= ${new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)})
        )
      ORDER BY "eligibleAt" ASC, e."id" ASC LIMIT ${limit}
    `);
    for (const candidate of candidates) {
      await this.prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<{ id: string; suspended: boolean }[]>(Prisma.sql`
          SELECT e."id", COALESCE((SELECT s."action" = 'APPLIED' FROM "identity_evidence_disposal_suspension_events" s WHERE s."attempt_id" = a."id" ORDER BY s."created_at" DESC, s."id" DESC LIMIT 1), false) AS "suspended"
          FROM "professional_profiles" p
          JOIN "professional_identity_verification_attempts" a ON a."professional_profile_id" = p."id"
          JOIN "identity_verification_evidence_references" e ON e."attempt_id" = a."id"
          WHERE e."id" = ${candidate.evidenceId}::uuid
            AND e."kind" IN ('DOCUMENT'::"IdentityVerificationEvidenceKind", 'SELFIE'::"IdentityVerificationEvidenceKind")
            AND e."reference" IS NOT NULL AND e."discard_requested_at" IS NULL AND e."discarded_at" IS NULL
            AND a."status" <> 'UNDER_REVIEW'::"ProfessionalIdentityVerificationAttemptStatus"
          FOR UPDATE OF p, a, e
        `);
        if (!locked || locked.suspended || candidate.eligibleAt > now) return;
        const inserted = await tx.$executeRaw(Prisma.sql`
          INSERT INTO "identity_evidence_disposal_tasks" ("id", "evidence_id", "object_key", "policy_version", "reason", "eligible_at", "status", "attempt_count", "next_attempt_at", "created_at", "updated_at")
          VALUES (${randomUUID()}::uuid, ${candidate.evidenceId}::uuid, ${candidate.objectKey}, ${POLICY_VERSION}, ${candidate.reason}, ${candidate.eligibleAt}, 'PENDING'::"IdentityEvidenceDisposalTaskStatus", 0, ${now}, ${now}, ${now})
          ON CONFLICT ("evidence_id") DO NOTHING
        `);
        if (inserted > 0) await tx.$executeRaw(Prisma.sql`
          UPDATE "identity_verification_evidence_references" SET "discard_requested_at" = ${now}
          WHERE "id" = ${candidate.evidenceId}::uuid AND "discard_requested_at" IS NULL AND "discarded_at" IS NULL
        `);
      });
    }
  }

  private async claimTasks(tx: Prisma.TransactionClient, now: Date, limit: number): Promise<Claim[]> {
    const tasks = await tx.$queryRaw<{ id: string; evidenceId: string; objectKey: string; attemptCount: number }[]>(Prisma.sql`
      SELECT "id", "evidence_id" AS "evidenceId", "object_key" AS "objectKey", "attempt_count" AS "attemptCount"
      FROM "identity_evidence_disposal_tasks"
      WHERE ("status" = 'PENDING'::"IdentityEvidenceDisposalTaskStatus" AND "next_attempt_at" <= ${now})
         OR ("status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus" AND "lease_expires_at" <= ${now})
      ORDER BY "next_attempt_at" ASC, "id" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
    `);
    const claims: Claim[] = [];
    for (const task of tasks) {
      const [state] = await tx.$queryRaw<{ attemptId: string; status: string; discardedAt: Date | null; suspended: boolean }[]>(Prisma.sql`
        SELECT e."attempt_id" AS "attemptId", a."status"::text AS "status", e."discarded_at" AS "discardedAt",
          COALESCE((SELECT s."action" = 'APPLIED' FROM "identity_evidence_disposal_suspension_events" s WHERE s."attempt_id" = a."id" ORDER BY s."created_at" DESC, s."id" DESC LIMIT 1), false) AS "suspended"
        FROM "identity_verification_evidence_references" e
        JOIN "professional_identity_verification_attempts" a ON a."id" = e."attempt_id"
        WHERE e."id" = ${task.evidenceId}::uuid FOR UPDATE OF e, a
      `);
      if (!state || state.discardedAt || state.status === "UNDER_REVIEW" || state.suspended) {
        await tx.$executeRaw(Prisma.sql`UPDATE "identity_evidence_disposal_tasks" SET "status" = 'PENDING'::"IdentityEvidenceDisposalTaskStatus", "next_attempt_at" = ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}, "lease_expires_at" = NULL, "updated_at" = ${now} WHERE "id" = ${task.id}::uuid`);
        continue;
      }
      const nextAttemptCount = task.attemptCount + 1;
      if (nextAttemptCount > MAX_ATTEMPTS) {
        await tx.$executeRaw(Prisma.sql`UPDATE "identity_evidence_disposal_tasks" SET "status" = 'FAILED'::"IdentityEvidenceDisposalTaskStatus", "completed_at" = ${now}, "lease_expires_at" = NULL, "last_error" = 'ATTEMPT_LIMIT_REACHED', "updated_at" = ${now} WHERE "id" = ${task.id}::uuid`);
        continue;
      }
      const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "identity_evidence_disposal_tasks"
        SET "status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus", "attempt_count" = ${nextAttemptCount}, "lease_expires_at" = ${leaseExpiresAt}, "irreversible_started_at" = ${now}, "last_error" = NULL, "updated_at" = ${now}
        WHERE "id" = ${task.id}::uuid
      `);
      await tx.$executeRaw(Prisma.sql`UPDATE "identity_verification_evidence_references" SET "discard_started_at" = ${now} WHERE "id" = ${task.evidenceId}::uuid AND "discarded_at" IS NULL`);
      claims.push({ ...task, attemptCount: nextAttemptCount, leaseExpiresAt });
    }
    return claims;
  }

  private async deleteClaimedEvidence(claim: Claim, now: Date): Promise<void> {
    try {
      await this.storage.delete(claim.objectKey);
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "identity_verification_evidence_references" SET "reference" = NULL, "discarded_at" = ${now}
          WHERE "id" = ${claim.evidenceId}::uuid AND "discarded_at" IS NULL
        `);
        await tx.$executeRaw(Prisma.sql`
          UPDATE "identity_evidence_disposal_tasks" SET "status" = 'COMPLETED'::"IdentityEvidenceDisposalTaskStatus", "completed_at" = ${now}, "lease_expires_at" = NULL, "last_error" = NULL, "updated_at" = ${now}
          WHERE "id" = ${claim.id}::uuid AND "status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus" AND "lease_expires_at" = ${claim.leaseExpiresAt}
        `);
      });
    } catch {
      const terminal = claim.attemptCount >= MAX_ATTEMPTS;
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "identity_evidence_disposal_tasks"
        SET "status" = ${terminal ? "FAILED" : "PENDING"}::"IdentityEvidenceDisposalTaskStatus", "completed_at" = ${terminal ? now : null}, "next_attempt_at" = ${new Date(now.getTime() + RETRY_BASE_MS * 2 ** (claim.attemptCount - 1))}, "lease_expires_at" = NULL, "last_error" = 'STORAGE_DELETE_FAILED', "updated_at" = ${now}
        WHERE "id" = ${claim.id}::uuid AND "status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus" AND "lease_expires_at" = ${claim.leaseExpiresAt}
      `);
    }
  }
}
