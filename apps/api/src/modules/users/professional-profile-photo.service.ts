import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import {
  Prisma,
  ProfessionalProfilePhotoDeletionStatus,
} from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import {
  processProfessionalProfilePhoto,
  type ProcessProfessionalProfilePhotoInput,
} from "./professional-profile-photo-image";
import { CurrentProfessionalProfileNotFoundException } from "./errors/current-professional-profile-not-found.exception";
import { ProfessionalProfilePhotoCandidateUnavailableException } from "./errors/professional-profile-photo-candidate-unavailable.exception";

const PROFESSIONAL_PROFILE_PHOTO_OBJECT_KEY_PREFIX = "professional-profile-photos";
const CANDIDATE_RECOVERY_DELAY_MS = 60 * 60 * 1000;
const CLEANUP_LEASE_MS = 5 * 60 * 1000;
const CLEANUP_RETRY_BASE_DELAY_MS = 60 * 1000;
const CLEANUP_MAX_ATTEMPTS = 5;
const CLEANUP_BATCH_LIMIT = 25;
const CANDIDATE_RECONCILIATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_RECONCILIATION_RETRY_BASE_DELAY_MS = 60 * 1000;
const UPLOAD_CANDIDATE_KIND = "UPLOAD_CANDIDATE";
const PHOTO_DELETE_KIND = "PHOTO_DELETE";

type ProfessionalProfilePhotoTaskKind =
  | typeof UPLOAD_CANDIDATE_KIND
  | typeof PHOTO_DELETE_KIND;

interface UploadedProfessionalProfilePhoto extends ProcessProfessionalProfilePhotoInput {}

interface CleanupClaim {
  id: string;
  objectKey: string;
  attemptCount: number;
  leaseExpiresAt: Date;
}

interface CandidateReconciliationClaim {
  id: string;
  objectKey: string;
  attemptCount: number;
  leaseExpiresAt: Date;
}

@Injectable()
export class ProfessionalProfilePhotoService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async replaceCurrent(
    userId: string,
    input: UploadedProfessionalProfilePhoto,
  ): Promise<{ objectKey: string; mimeType: "image/webp"; width: number; height: number; sizeBytes: number }> {
    await this.ensureEligibleProfile(userId);

    const processed = await processProfessionalProfilePhoto(input);
    const objectKey = this.newObjectKey();
    const associationDeadlineAt = new Date(Date.now() + CANDIDATE_RECOVERY_DELAY_MS);

    await this.createUploadCandidate(objectKey, associationDeadlineAt);

    await this.storage.upload({
      objectKey,
      body: processed.buffer,
      contentType: processed.mimeType,
      sizeBytes: processed.sizeBytes,
    });

    await this.prisma.$transaction(async (transaction) => {
      const candidate = await this.lockCleanupTask(transaction, objectKey);
      if (candidate === null) {
        throw new ProfessionalProfilePhotoCandidateUnavailableException();
      }

      if (
        candidate.kind !== UPLOAD_CANDIDATE_KIND ||
        candidate.status !== ProfessionalProfilePhotoDeletionStatus.PENDING ||
        candidate.attemptCount !== 0 ||
        candidate.associationDeadlineAt === null ||
        new Date() >= candidate.associationDeadlineAt
      ) {
        throw new ProfessionalProfilePhotoCandidateUnavailableException();
      }

      await lockUserCategoryProtection(transaction, userId);
      const profile = await transaction.professionalProfile.findFirst({
        where: { userId, deletedAt: null, user: { deletedAt: null } },
        select: { id: true },
      });
      if (!profile) {
        throw new CurrentProfessionalProfileNotFoundException();
      }

      const previousPhoto = await transaction.professionalProfilePhoto.findUnique({
        where: { professionalProfileId: profile.id },
        select: { objectKey: true },
      });

      await transaction.professionalProfilePhoto.upsert({
        where: { professionalProfileId: profile.id },
        create: {
          professionalProfileId: profile.id,
          objectKey,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
        },
        update: {
          objectKey,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
        },
      });

      await transaction.professionalProfilePhotoDeletionTask.delete({
        where: { id: candidate.id },
      });

      if (previousPhoto) {
        await this.createDeletionTask(transaction, previousPhoto.objectKey);
      }
    });

    return {
      objectKey,
      mimeType: processed.mimeType,
      width: processed.width,
      height: processed.height,
      sizeBytes: processed.sizeBytes,
    };
  }

  async removeCurrent(userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await lockUserCategoryProtection(transaction, userId);
      const profile = await transaction.professionalProfile.findFirst({
        where: { userId, deletedAt: null, user: { deletedAt: null } },
        select: { id: true },
      });
      if (!profile) {
        throw new CurrentProfessionalProfileNotFoundException();
      }

      const photo = await transaction.professionalProfilePhoto.findUnique({
        where: { professionalProfileId: profile.id },
        select: { objectKey: true },
      });
      if (!photo) {
        return;
      }

      await transaction.professionalProfilePhoto.delete({
        where: { professionalProfileId: profile.id },
      });
      await this.createDeletionTask(transaction, photo.objectKey);
    });
  }

  async processCleanupBatch(
    now = new Date(),
    limit = CLEANUP_BATCH_LIMIT,
  ): Promise<void> {
    const claims = await this.prisma.$transaction((transaction) =>
      this.claimCleanupTasks(transaction, now, limit),
    );

    for (const claim of claims) {
      try {
        await this.storage.delete(claim.objectKey);
        await this.completeCleanupTask(claim, new Date());
      } catch {
        await this.retryCleanupTask(claim, new Date());
      }
    }
  }

  async processCandidateReconciliationBatch(
    now = new Date(),
    limit = CLEANUP_BATCH_LIMIT,
  ): Promise<void> {
    const claims = await this.prisma.$transaction((transaction) =>
      this.claimCandidateReconciliationTasks(transaction, now, limit),
    );

    for (const claim of claims) {
      try {
        await this.storage.delete(claim.objectKey);
        await this.completeCandidateReconciliation(claim, new Date());
      } catch {
        await this.retryCandidateReconciliation(claim, new Date());
      }
    }
  }

  private async ensureEligibleProfile(userId: string): Promise<void> {
    const profile = await this.prisma.professionalProfile.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: { id: true },
    });
    if (!profile) {
      throw new CurrentProfessionalProfileNotFoundException();
    }
  }

  private newObjectKey(): string {
    return `${PROFESSIONAL_PROFILE_PHOTO_OBJECT_KEY_PREFIX}/${randomUUID()}.webp`;
  }

  private async createDeletionTask(
    transaction: Prisma.TransactionClient,
    objectKey: string,
  ): Promise<void> {
    await transaction.professionalProfilePhotoDeletionTask.create({
      data: {
        objectKey,
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
        nextAttemptAt: new Date(),
      },
    });
  }

  private async createUploadCandidate(
    objectKey: string,
    associationDeadlineAt: Date,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "professional_profile_photo_deletion_tasks" (
        "id",
        "object_key",
        "kind",
        "status",
        "attempt_count",
        "next_attempt_at",
        "association_deadline_at",
        "reconcile_next_at",
        "reconcile_attempt_count",
        "created_at",
        "updated_at"
      ) VALUES (
        ${randomUUID()}::uuid,
        ${objectKey},
        ${UPLOAD_CANDIDATE_KIND}::"ProfessionalProfilePhotoTaskKind",
        ${ProfessionalProfilePhotoDeletionStatus.PENDING}::"ProfessionalProfilePhotoDeletionStatus",
        0,
        ${associationDeadlineAt},
        ${associationDeadlineAt},
        ${associationDeadlineAt},
        0,
        ${now},
        ${now}
      )
    `);
  }

  private async lockCleanupTask(
    transaction: Prisma.TransactionClient,
    objectKey: string,
  ): Promise<{
    id: string;
    kind: ProfessionalProfilePhotoTaskKind;
    status: ProfessionalProfilePhotoDeletionStatus;
    attemptCount: number;
    associationDeadlineAt: Date | null;
  } | null> {
    const [task] = await transaction.$queryRaw<
      {
        id: string;
        kind: ProfessionalProfilePhotoTaskKind;
        status: ProfessionalProfilePhotoDeletionStatus;
        attemptCount: number;
        associationDeadlineAt: Date | null;
      }[]
    >(Prisma.sql`
      SELECT
        "id",
        "kind",
        "status",
        "attempt_count" AS "attemptCount",
        "association_deadline_at" AS "associationDeadlineAt"
      FROM "professional_profile_photo_deletion_tasks"
      WHERE "object_key" = ${objectKey}
      FOR UPDATE
    `);
    return task ?? null;
  }

  private async claimCleanupTasks(
    transaction: Prisma.TransactionClient,
    now: Date,
    limit: number,
  ): Promise<CleanupClaim[]> {
    const boundedLimit = Math.max(1, Math.min(limit, CLEANUP_BATCH_LIMIT));
    const candidates = await transaction.$queryRaw<
      {
        id: string;
        objectKey: string;
        attemptCount: number;
        status: ProfessionalProfilePhotoDeletionStatus;
      }[]
    >(Prisma.sql`
      SELECT "id", "object_key" AS "objectKey", "attempt_count" AS "attemptCount", "status"
      FROM "professional_profile_photo_deletion_tasks"
      WHERE (
        "status" = ${ProfessionalProfilePhotoDeletionStatus.PENDING}::"ProfessionalProfilePhotoDeletionStatus"
        AND "next_attempt_at" <= ${now}
      ) OR (
        "status" = ${ProfessionalProfilePhotoDeletionStatus.PROCESSING}::"ProfessionalProfilePhotoDeletionStatus"
        AND "lease_expires_at" <= ${now}
      )
      ORDER BY "next_attempt_at" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    `);

    const claims: CleanupClaim[] = [];
    for (const candidate of candidates) {
      if (candidate.attemptCount >= CLEANUP_MAX_ATTEMPTS) {
        await transaction.professionalProfilePhotoDeletionTask.update({
          where: { id: candidate.id },
          data: {
            status: ProfessionalProfilePhotoDeletionStatus.FAILED,
            completedAt: now,
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: "CLEANUP_ATTEMPT_LIMIT_REACHED",
          },
        });
        continue;
      }

      const referenced = await transaction.professionalProfilePhoto.findUnique({
        where: { objectKey: candidate.objectKey },
        select: { professionalProfileId: true },
      });
      if (referenced) {
        await transaction.professionalProfilePhotoDeletionTask.update({
          where: { id: candidate.id },
          data: {
            status: ProfessionalProfilePhotoDeletionStatus.FAILED,
            completedAt: now,
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: "OBJECT_STILL_REFERENCED",
          },
        });
        continue;
      }

      const leaseExpiresAt = new Date(now.getTime() + CLEANUP_LEASE_MS);
      await transaction.professionalProfilePhotoDeletionTask.update({
        where: { id: candidate.id },
        data: {
          status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
          attemptCount: candidate.attemptCount + 1,
          claimedAt: now,
          leaseExpiresAt,
          completedAt: null,
          lastError: null,
        },
      });
      claims.push({
        id: candidate.id,
        objectKey: candidate.objectKey,
        attemptCount: candidate.attemptCount + 1,
        leaseExpiresAt,
      });
    }

    return claims;
  }

  private async claimCandidateReconciliationTasks(
    transaction: Prisma.TransactionClient,
    now: Date,
    limit: number,
  ): Promise<CandidateReconciliationClaim[]> {
    const boundedLimit = Math.max(1, Math.min(limit, CLEANUP_BATCH_LIMIT));
    const candidates = await transaction.$queryRaw<
      {
        id: string;
        objectKey: string;
        reconcileAttemptCount: number;
      }[]
    >(Prisma.sql`
      SELECT
        "id",
        "object_key" AS "objectKey",
        "reconcile_attempt_count" AS "reconcileAttemptCount"
      FROM "professional_profile_photo_deletion_tasks"
      WHERE "kind" = ${UPLOAD_CANDIDATE_KIND}::"ProfessionalProfilePhotoTaskKind"
        AND "status" IN (
          ${ProfessionalProfilePhotoDeletionStatus.COMPLETED}::"ProfessionalProfilePhotoDeletionStatus",
          ${ProfessionalProfilePhotoDeletionStatus.FAILED}::"ProfessionalProfilePhotoDeletionStatus"
        )
        AND (
          (
            "reconcile_lease_expires_at" IS NULL
            AND "reconcile_next_at" <= ${now}
          )
          OR "reconcile_lease_expires_at" <= ${now}
        )
      ORDER BY "reconcile_next_at" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    `);

    const claims: CandidateReconciliationClaim[] = [];
    for (const candidate of candidates) {
      const referenced = await transaction.professionalProfilePhoto.findUnique({
        where: { objectKey: candidate.objectKey },
        select: { professionalProfileId: true },
      });
      const nextAttemptCount = candidate.reconcileAttemptCount + 1;
      if (referenced) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "professional_profile_photo_deletion_tasks"
          SET
            "reconcile_attempt_count" = ${nextAttemptCount},
            "reconcile_next_at" = ${this.nextCandidateReconciliationAt(now, nextAttemptCount)},
            "reconcile_claimed_at" = NULL,
            "reconcile_lease_expires_at" = NULL,
            "reconcile_last_error" = ${"OBJECT_STILL_REFERENCED"},
            "updated_at" = ${now}
          WHERE "id" = ${candidate.id}::uuid
        `);
        continue;
      }

      const leaseExpiresAt = new Date(now.getTime() + CLEANUP_LEASE_MS);
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "professional_profile_photo_deletion_tasks"
        SET
          "reconcile_attempt_count" = ${nextAttemptCount},
          "reconcile_claimed_at" = ${now},
          "reconcile_lease_expires_at" = ${leaseExpiresAt},
          "reconcile_last_error" = NULL,
          "updated_at" = ${now}
        WHERE "id" = ${candidate.id}::uuid
      `);
      claims.push({
        id: candidate.id,
        objectKey: candidate.objectKey,
        attemptCount: nextAttemptCount,
        leaseExpiresAt,
      });
    }

    return claims;
  }

  private async completeCleanupTask(claim: CleanupClaim, completedAt: Date): Promise<void> {
    await this.prisma.professionalProfilePhotoDeletionTask.updateMany({
      where: {
        id: claim.id,
        status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
        leaseExpiresAt: claim.leaseExpiresAt,
      },
      data: {
        status: ProfessionalProfilePhotoDeletionStatus.COMPLETED,
        completedAt,
        claimedAt: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
  }

  private async retryCleanupTask(claim: CleanupClaim, now: Date): Promise<void> {
    const isTerminal = claim.attemptCount >= CLEANUP_MAX_ATTEMPTS;
    await this.prisma.professionalProfilePhotoDeletionTask.updateMany({
      where: {
        id: claim.id,
        status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
        leaseExpiresAt: claim.leaseExpiresAt,
      },
      data: isTerminal
        ? {
            status: ProfessionalProfilePhotoDeletionStatus.FAILED,
            completedAt: now,
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: "STORAGE_DELETE_FAILED",
          }
        : {
            status: ProfessionalProfilePhotoDeletionStatus.PENDING,
            nextAttemptAt: new Date(
              now.getTime() + CLEANUP_RETRY_BASE_DELAY_MS * 2 ** (claim.attemptCount - 1),
            ),
            claimedAt: null,
            leaseExpiresAt: null,
            lastError: "STORAGE_DELETE_FAILED",
          },
    });
  }

  private async completeCandidateReconciliation(
    claim: CandidateReconciliationClaim,
    now: Date,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "professional_profile_photo_deletion_tasks"
      SET
        "reconcile_next_at" = ${new Date(now.getTime() + CANDIDATE_RECONCILIATION_INTERVAL_MS)},
        "reconcile_claimed_at" = NULL,
        "reconcile_lease_expires_at" = NULL,
        "reconcile_last_error" = NULL,
        "updated_at" = ${now}
      WHERE "id" = ${claim.id}::uuid
        AND "reconcile_lease_expires_at" = ${claim.leaseExpiresAt}
    `);
  }

  private async retryCandidateReconciliation(
    claim: CandidateReconciliationClaim,
    now: Date,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "professional_profile_photo_deletion_tasks"
      SET
        "reconcile_next_at" = ${this.nextCandidateReconciliationAt(now, claim.attemptCount)},
        "reconcile_claimed_at" = NULL,
        "reconcile_lease_expires_at" = NULL,
        "reconcile_last_error" = ${"STORAGE_RECONCILIATION_FAILED"},
        "updated_at" = ${now}
      WHERE "id" = ${claim.id}::uuid
        AND "reconcile_lease_expires_at" = ${claim.leaseExpiresAt}
    `);
  }

  private nextCandidateReconciliationAt(now: Date, attemptCount: number): Date {
    const delay = Math.min(
      CANDIDATE_RECONCILIATION_INTERVAL_MS,
      CANDIDATE_RECONCILIATION_RETRY_BASE_DELAY_MS * 2 ** Math.min(attemptCount - 1, 16),
    );
    return new Date(now.getTime() + delay);
  }
}
