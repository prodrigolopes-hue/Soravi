import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { IdentityEvidenceDisposalTaskStatus, Prisma } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";

const POLICY_VERSION = "identity-media-v1";
const BATCH_LIMIT = 25;
const LEASE_MS = 5 * 60 * 1000;
const RETRY_BASE_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const ALLOWED_STORAGE_HTTP_STATUS_CODES = new Set([400, 401, 403, 404, 408, 409, 429, 500, 502, 503, 504]);
const ALLOWED_STORAGE_PROVIDER_CODES = new Set([
  "AccessDenied",
  "InternalError",
  "InvalidAccessKeyId",
  "NoSuchBucket",
  "RequestTimeout",
  "ServiceUnavailable",
  "SlowDown",
]);

type Candidate = { evidenceId: string; attemptId: string; objectKey: string; reason: string; eligibleAt: Date };
type Claim = { id: string; evidenceId: string; attemptId: string; objectKey: string; attemptCount: number; leaseExpiresAt: Date };
type PreviewRow = {
  evidenceId: string;
  attemptId: string;
  objectKey: string | null;
  kind: string;
  createdAt: Date;
  supersededAt: Date | null;
  attemptStatus: string;
  closedAt: Date | null;
  lastEvidenceAt: Date | null;
  decisionAt: Date | null;
  discardRequestedAt: Date | null;
  discardStartedAt: Date | null;
  discardedAt: Date | null;
  reason: string | null;
  eligibleAt: Date | null;
  suspended: boolean;
};
export interface IdentityEvidenceDisposalPreview {
  policyVersion: string;
  referenceAt: Date;
  executionEnabled: boolean;
  totalsByReason: Record<string, number>;
  items: Array<{
    evidenceId: string; attemptId: string; kind: string; createdAt: Date; supersededAt: Date | null;
    attemptStatus: string; closedAt: Date | null; lastEvidenceAt: Date | null; decisionAt: Date | null;
    discardRequestedAt: Date | null; discardStartedAt: Date | null; discardedAt: Date | null;
    reason: string | null; eligibleAt: Date | null; policyEligible: boolean; executionEligible: boolean; impediments: string[];
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface IdentityEvidenceDisposalTaskList {
  items: Array<{
    id: string; attemptId: string; kind: string; status: string; attemptCount: number; policyVersion: string;
    eligibleAt: Date; nextAttemptAt: Date; leaseExpiresAt: Date | null; irreversibleStartedAt: Date | null;
    completedAt: Date | null; createdAt: Date; updatedAt: Date;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

@Injectable()
export class ProfessionalIdentityEvidenceDisposalService {
  private readonly logger = new Logger(ProfessionalIdentityEvidenceDisposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly config?: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.config?.get("IDENTITY_EVIDENCE_DISPOSAL_ENABLED") === "true";
  }

  async listTasks(page = 1, pageSize = 20, status?: IdentityEvidenceDisposalTaskStatus): Promise<IdentityEvidenceDisposalTaskList> {
    const where: { status?: IdentityEvidenceDisposalTaskStatus } = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.identityEvidenceDisposalTask.findMany({
        where,
        select: {
          id: true, status: true, attemptCount: true, policyVersion: true, eligibleAt: true, nextAttemptAt: true,
          leaseExpiresAt: true, irreversibleStartedAt: true, completedAt: true, createdAt: true, updatedAt: true,
          evidence: { select: { attemptId: true, kind: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.identityEvidenceDisposalTask.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ id: item.id, attemptId: item.evidence.attemptId, kind: item.evidence.kind, status: item.status, attemptCount: item.attemptCount, policyVersion: item.policyVersion, eligibleAt: item.eligibleAt, nextAttemptAt: item.nextAttemptAt, leaseExpiresAt: item.leaseExpiresAt, irreversibleStartedAt: item.irreversibleStartedAt, completedAt: item.completedAt, createdAt: item.createdAt, updatedAt: item.updatedAt })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async preview(now = new Date(), page = 1, pageSize = 20): Promise<IdentityEvidenceDisposalPreview> {
    const offset = (page - 1) * pageSize;
    const rows = await this.prisma.$queryRaw<PreviewRow[]>(this.previewQuery(now, pageSize, offset));
    const [count] = await this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT count(*) AS "total" FROM (${this.previewBaseQuery()}) preview WHERE preview."reason" IS NOT NULL AND preview."eligibleAt" <= ${now}
    `);
    const totals = await this.prisma.$queryRaw<Array<{ reason: string; total: bigint }>>(Prisma.sql`
      SELECT preview."reason", count(*) AS "total" FROM (${this.previewBaseQuery()}) preview
      WHERE preview."reason" IS NOT NULL AND preview."eligibleAt" <= ${now} GROUP BY preview."reason" ORDER BY preview."reason" ASC
    `);
    return {
      policyVersion: POLICY_VERSION,
      referenceAt: now,
      executionEnabled: this.isEnabled(),
      totalsByReason: Object.fromEntries(totals.map((item) => [item.reason, Number(item.total)])),
      items: rows.map((row) => {
        const impediments: string[] = [];
        if (row.attemptStatus === "UNDER_REVIEW") impediments.push("UNDER_REVIEW");
        if (row.suspended) impediments.push("DISPOSAL_SUSPENDED");
        if (row.discardRequestedAt) impediments.push("DISCARD_ALREADY_REQUESTED");
        if (row.discardStartedAt) impediments.push("DISCARD_IN_PROGRESS");
        if (row.discardedAt) impediments.push("ALREADY_DISCARDED");
        if (row.reason === "INCOMPLETE_ATTEMPT" && row.attemptStatus === "AWAITING_EVIDENCE") impediments.push("ATTEMPT_EXPIRATION_REQUIRED");
        const policyEligible = row.reason !== null && row.eligibleAt !== null && row.eligibleAt <= now;
        return {
          evidenceId: row.evidenceId,
          attemptId: row.attemptId,
          kind: row.kind,
          createdAt: row.createdAt,
          supersededAt: row.supersededAt,
          attemptStatus: row.attemptStatus,
          closedAt: row.closedAt,
          lastEvidenceAt: row.lastEvidenceAt,
          decisionAt: row.decisionAt,
          discardRequestedAt: row.discardRequestedAt,
          discardStartedAt: row.discardStartedAt,
          discardedAt: row.discardedAt,
          reason: row.reason,
          eligibleAt: row.eligibleAt,
          policyEligible,
          executionEligible: policyEligible && impediments.length === 0,
          impediments,
        };
      }),
      pagination: { page, pageSize, total: Number(count?.total ?? 0n), totalPages: Math.ceil(Number(count?.total ?? 0n) / pageSize) },
    };
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

  private previewBaseQuery(): Prisma.Sql {
    return Prisma.sql`
      SELECT e."id" AS "evidenceId", e."attempt_id" AS "attemptId", e."reference" AS "objectKey", e."kind"::text AS "kind", e."created_at" AS "createdAt", e."superseded_at" AS "supersededAt",
        a."status"::text AS "attemptStatus", a."closed_at" AS "closedAt", last_evidence."lastEvidenceAt", decision."decisionAt",
        e."discard_requested_at" AS "discardRequestedAt", e."discard_started_at" AS "discardStartedAt", e."discarded_at" AS "discardedAt",
        CASE WHEN e."superseded_at" IS NOT NULL THEN 'SUPERSEDED'
          WHEN a."status" IN ('AWAITING_EVIDENCE'::"ProfessionalIdentityVerificationAttemptStatus", 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus") AND last_evidence."lastEvidenceAt" IS NOT NULL THEN 'INCOMPLETE_ATTEMPT'
          WHEN a."status" = 'CLOSED'::"ProfessionalIdentityVerificationAttemptStatus" AND decision."decisionAt" IS NOT NULL THEN 'CLOSED_ATTEMPT'
          ELSE NULL END AS "reason",
        CASE WHEN e."superseded_at" IS NOT NULL THEN e."superseded_at" + INTERVAL '7 days'
          WHEN a."status" IN ('AWAITING_EVIDENCE'::"ProfessionalIdentityVerificationAttemptStatus", 'CANCELLED'::"ProfessionalIdentityVerificationAttemptStatus") THEN last_evidence."lastEvidenceAt" + INTERVAL '30 days'
          WHEN a."status" = 'CLOSED'::"ProfessionalIdentityVerificationAttemptStatus" THEN decision."decisionAt" + INTERVAL '90 days'
          ELSE NULL END AS "eligibleAt",
        COALESCE(suspension."action" = 'APPLIED', false) AS "suspended"
      FROM "identity_verification_evidence_references" e
      JOIN "professional_identity_verification_attempts" a ON a."id" = e."attempt_id"
      LEFT JOIN LATERAL (SELECT MAX(x."created_at") AS "lastEvidenceAt" FROM "identity_verification_evidence_references" x WHERE x."attempt_id" = a."id") last_evidence ON true
      LEFT JOIN LATERAL (SELECT MAX(d."created_at") AS "decisionAt" FROM "identity_verification_decisions" d WHERE d."attempt_id" = a."id") decision ON true
      LEFT JOIN LATERAL (SELECT s."action" FROM "identity_evidence_disposal_suspension_events" s WHERE s."attempt_id" = a."id" ORDER BY s."created_at" DESC, s."id" DESC LIMIT 1) suspension ON true
      WHERE e."kind" IN ('DOCUMENT'::"IdentityVerificationEvidenceKind", 'SELFIE'::"IdentityVerificationEvidenceKind")
    `;
  }

  private previewQuery(now: Date, pageSize: number, offset: number): Prisma.Sql {
    return Prisma.sql`
      SELECT * FROM (${this.previewBaseQuery()}) preview
      WHERE preview."reason" IS NOT NULL AND preview."eligibleAt" <= ${now}
      ORDER BY preview."eligibleAt" ASC NULLS LAST, preview."evidenceId" ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
  }

  private async scheduleEligibleEvidence(now: Date, limit: number): Promise<void> {
    const candidates = await this.prisma.$queryRaw<Candidate[]>(Prisma.sql`
      SELECT preview."evidenceId", preview."attemptId", preview."objectKey", preview."reason", preview."eligibleAt"
      FROM (${this.previewBaseQuery()}) preview
      WHERE preview."reason" IS NOT NULL AND preview."eligibleAt" <= ${now}
        AND preview."objectKey" IS NOT NULL AND preview."discardRequestedAt" IS NULL AND preview."discardedAt" IS NULL
        AND preview."attemptStatus" <> 'UNDER_REVIEW' AND NOT preview."suspended"
      ORDER BY preview."eligibleAt" ASC, preview."evidenceId" ASC LIMIT ${limit}
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
        this.logFailure("IDENTITY_EVIDENCE_DISPOSAL_ATTEMPT_LIMIT_REACHED", {
          taskId: task.id,
          verificationAttemptId: state.attemptId,
          executionAttempt: nextAttemptCount,
        });
        continue;
      }
      const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "identity_evidence_disposal_tasks"
        SET "status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus", "attempt_count" = ${nextAttemptCount}, "lease_expires_at" = ${leaseExpiresAt}, "irreversible_started_at" = ${now}, "last_error" = NULL, "updated_at" = ${now}
        WHERE "id" = ${task.id}::uuid
      `);
      await tx.$executeRaw(Prisma.sql`UPDATE "identity_verification_evidence_references" SET "discard_started_at" = ${now} WHERE "id" = ${task.evidenceId}::uuid AND "discarded_at" IS NULL`);
      claims.push({ ...task, attemptId: state.attemptId, attemptCount: nextAttemptCount, leaseExpiresAt });
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
    } catch (error: unknown) {
      const terminal = claim.attemptCount >= MAX_ATTEMPTS;
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "identity_evidence_disposal_tasks"
        SET "status" = ${terminal ? "FAILED" : "PENDING"}::"IdentityEvidenceDisposalTaskStatus", "completed_at" = ${terminal ? now : null}, "next_attempt_at" = ${new Date(now.getTime() + RETRY_BASE_MS * 2 ** (claim.attemptCount - 1))}, "lease_expires_at" = NULL, "last_error" = 'STORAGE_DELETE_FAILED', "updated_at" = ${now}
        WHERE "id" = ${claim.id}::uuid AND "status" = 'PROCESSING'::"IdentityEvidenceDisposalTaskStatus" AND "lease_expires_at" = ${claim.leaseExpiresAt}
      `);
      this.logFailure("IDENTITY_EVIDENCE_DISPOSAL_STORAGE_DELETE_FAILED", {
        taskId: claim.id,
        verificationAttemptId: claim.attemptId,
        executionAttempt: claim.attemptCount,
      }, error);
      if (terminal) {
        this.logFailure("IDENTITY_EVIDENCE_DISPOSAL_ATTEMPT_LIMIT_REACHED", {
          taskId: claim.id,
          verificationAttemptId: claim.attemptId,
          executionAttempt: claim.attemptCount,
        });
      }
    }
  }

  private logFailure(
    eventCode: "IDENTITY_EVIDENCE_DISPOSAL_STORAGE_DELETE_FAILED" | "IDENTITY_EVIDENCE_DISPOSAL_ATTEMPT_LIMIT_REACHED",
    correlation: { taskId: string; verificationAttemptId: string; executionAttempt: number },
    error?: unknown,
  ): void {
    try {
      const storage = this.sanitizeStorageError(error);
      this.logger.error(
        `Falha sanitizada no descarte de evidências de identidade. eventCode=${eventCode} taskId=${correlation.taskId} verificationAttemptId=${correlation.verificationAttemptId} executionAttempt=${correlation.executionAttempt} storageHttpStatus=${storage.httpStatus} storageProviderCode=${storage.providerCode}`,
      );
    } catch {
      // Diagnostics must not alter disposal retries, transactions, or deletion behavior.
    }
  }

  private sanitizeStorageError(error: unknown): { httpStatus: number | "UNKNOWN"; providerCode: string } {
    if (!error || typeof error !== "object") return { httpStatus: "UNKNOWN", providerCode: "UNKNOWN" };
    const candidate = error as { $metadata?: { httpStatusCode?: unknown }; statusCode?: unknown; code?: unknown; name?: unknown };
    const httpStatusCandidate = candidate.$metadata?.httpStatusCode ?? candidate.statusCode;
    const providerCodeCandidate = candidate.code ?? candidate.name;
    return {
      httpStatus: typeof httpStatusCandidate === "number" && ALLOWED_STORAGE_HTTP_STATUS_CODES.has(httpStatusCandidate) ? httpStatusCandidate : "UNKNOWN",
      providerCode: typeof providerCodeCandidate === "string" && ALLOWED_STORAGE_PROVIDER_CODES.has(providerCodeCandidate) ? providerCodeCandidate : "UNKNOWN",
    };
  }
}
