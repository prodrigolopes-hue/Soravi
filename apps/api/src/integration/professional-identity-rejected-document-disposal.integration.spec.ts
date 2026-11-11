import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type sharpFactory from "sharp";

import { Prisma, UserStatus } from "../generated/prisma/client";
import { ProfessionalIdentityDocumentService } from "../modules/users/professional-identity-document.service";
import { ProfessionalIdentityEvidenceDisposalService } from "../modules/users/professional-identity-evidence-disposal.service";
import { ProfessionalIdentityReviewService } from "../modules/users/professional-identity-review.service";
import type { StorageService } from "../storage/storage.service";
import { createIntegrationPrismaService } from "./integration-database";

const sharp: typeof sharpFactory = require("sharp");
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

describe("rejected professional identity document disposal", () => {
  const prisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();
  let syntheticImage: Buffer;

  beforeAll(async () => {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("The suite refuses to run outside the integration database.");
    }
    syntheticImage = await sharp({
      create: { width: 320, height: 200, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
  });

  afterEach(async () => {
    const discoveredAttemptIds = createdProfileIds.size === 0
      ? []
      : (await prisma.professionalIdentityVerificationAttempt.findMany({
        where: { professionalProfileId: { in: [...createdProfileIds] } },
        select: { id: true },
      })).map(({ id }) => id);
    const attemptIds = [...new Set([...createdAttemptIds, ...discoveredAttemptIds])];

    if (attemptIds.length > 0) {
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM "identity_evidence_disposal_tasks"
        WHERE "evidence_id" IN (
          SELECT "id" FROM "identity_verification_evidence_references"
          WHERE "attempt_id" IN (${Prisma.join(attemptIds)}::uuid)
        )
      `);
      await prisma.$executeRaw(Prisma.sql`
        DELETE FROM "identity_evidence_disposal_suspension_events"
        WHERE "attempt_id" IN (${Prisma.join(attemptIds)}::uuid)
      `);
      await prisma.identityVerificationEvidenceReference.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });
      await prisma.identityVerificationDecision.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });
      await prisma.professionalIdentityVerificationAttempt.deleteMany({
        where: { id: { in: attemptIds } },
      });
    }
    if (createdIdentityIds.size > 0) {
      await prisma.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    }
    if (createdProfileIds.size > 0) {
      await prisma.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    }
    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }
    createdUserIds.clear();
    createdProfileIds.clear();
    createdIdentityIds.clear();
    createdAttemptIds.clear();
  });

  afterAll(async () => prisma.$disconnect());

  it("removes the rejected document only at the exact ninety-day retention boundary", async () => {
    const fixture = await createFixture();
    const uploadedKeys = new Set<string>();
    const deletedKeys: string[] = [];
    const storage: StorageService = {
      upload: async ({ objectKey }) => {
        if (!objectKey) throw new Error("The document service must provide an object key.");
        uploadedKeys.add(objectKey);
        return { objectKey };
      },
      delete: async (objectKey) => {
        deletedKeys.push(objectKey);
        uploadedKeys.delete(objectKey);
      },
      createTemporaryReadUrl: async () => "https://storage.example.test/unused",
    };
    const documentService = new ProfessionalIdentityDocumentService(
      prisma,
      storage,
      new ConfigService({ PROFESSIONAL_IDENTITY_SELFIE_ENABLED: "false" }),
    );
    const reviewService = new ProfessionalIdentityReviewService(prisma, storage);
    const disposalService = new ProfessionalIdentityEvidenceDisposalService(
      prisma,
      storage,
      new ConfigService({ IDENTITY_EVIDENCE_DISPOSAL_ENABLED: "true" }),
    );

    await documentService.submitCurrent(fixture.professionalUserId, {
      buffer: syntheticImage,
      declaredMimeType: "image/png",
    });

    const attempt = await prisma.professionalIdentityVerificationAttempt.findFirstOrThrow({
      where: { professionalProfileId: fixture.profileId },
      select: { id: true, status: true },
    });
    createdAttemptIds.add(attempt.id);
    expect(attempt.status).toBe("UNDER_REVIEW");

    const evidenceBeforeDecision = await prisma.identityVerificationEvidenceReference.findFirstOrThrow({
      where: { attemptId: attempt.id, kind: "DOCUMENT", supersededAt: null },
      select: { id: true, reference: true },
    });
    expect(evidenceBeforeDecision.reference).not.toBeNull();
    const objectKey = evidenceBeforeDecision.reference as string;
    expect(uploadedKeys).toEqual(new Set([objectKey]));

    await reviewService.decide(fixture.adminUserId, attempt.id, {
      result: "NOT_CONFIRMED",
      reasonCode: "DATA_MISMATCH",
      criteriaVersion: "integration-rejected-document-v1",
    });

    const decision = await prisma.identityVerificationDecision.findFirstOrThrow({
      where: { attemptId: attempt.id },
      select: { id: true, createdAt: true, result: true, reasonCode: true },
    });
    const beforeBoundary = new Date(decision.createdAt.getTime() + NINETY_DAYS_MS - 1);
    const atBoundary = new Date(decision.createdAt.getTime() + NINETY_DAYS_MS);

    await disposalService.processBatch(beforeBoundary, 1);

    await expect(prisma.identityVerificationEvidenceReference.findUniqueOrThrow({
      where: { id: evidenceBeforeDecision.id },
      select: { reference: true, discardedAt: true },
    })).resolves.toEqual({ reference: objectKey, discardedAt: null });
    expect(deletedKeys).toEqual([]);
    await expect(prisma.identityEvidenceDisposalTask.count({
      where: { evidenceId: evidenceBeforeDecision.id },
    })).resolves.toBe(0);

    await disposalService.processBatch(atBoundary, 1);

    expect(deletedKeys).toEqual([objectKey]);
    await expect(prisma.identityVerificationEvidenceReference.findUniqueOrThrow({
      where: { id: evidenceBeforeDecision.id },
      select: { reference: true, discardedAt: true },
    })).resolves.toMatchObject({ reference: null, discardedAt: atBoundary });
    await expect(prisma.identityEvidenceDisposalTask.findUniqueOrThrow({
      where: { evidenceId: evidenceBeforeDecision.id },
      select: { status: true, completedAt: true, reason: true },
    })).resolves.toMatchObject({ status: "COMPLETED", completedAt: atBoundary, reason: "CLOSED_ATTEMPT" });
    await expect(prisma.professionalIdentityVerificationAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      select: { status: true, result: true, closedAt: true },
    })).resolves.toMatchObject({ status: "CLOSED", result: "NOT_CONFIRMED", closedAt: expect.any(Date) });
    await expect(prisma.identityVerificationDecision.findUniqueOrThrow({
      where: { id: decision.id },
      select: { result: true, reasonCode: true },
    })).resolves.toEqual({ result: "NOT_CONFIRMED", reasonCode: "DATA_MISMATCH" });
  });

  async function createFixture() {
    const professionalUserId = randomUUID();
    const adminUserId = randomUUID();
    const profileId = randomUUID();
    const identityId = randomUUID();
    createdUserIds.add(professionalUserId);
    createdUserIds.add(adminUserId);
    createdProfileIds.add(profileId);
    createdIdentityIds.add(identityId);
    await createUser(professionalUserId, "professional");
    await createUser(adminUserId, "admin");
    await prisma.professionalProfile.create({
      data: { id: profileId, userId: professionalUserId, displayName: "Rejected document" },
    });
    await prisma.personalIdentity.create({
      data: {
        id: identityId,
        userId: professionalUserId,
        cpfEnvelope: {},
        cpfHmac: randomUUID().replaceAll("-", ""),
        hmacKeyId: "integration",
      },
    });
    return { professionalUserId, adminUserId, profileId };
  }

  async function createUser(id: string, name: string): Promise<void> {
    const email = `${name}-${id}@example.test`;
    await prisma.user.create({
      data: {
        id,
        name,
        email,
        emailNormalized: email,
        passwordHash: "integration",
        status: UserStatus.ACTIVE,
      },
    });
  }
});
