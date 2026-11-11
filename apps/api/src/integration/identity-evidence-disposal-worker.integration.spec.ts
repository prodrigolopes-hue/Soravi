import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import { Prisma, UserStatus } from "../generated/prisma/client";
import { ProfessionalIdentityEvidenceDisposalService } from "../modules/users/professional-identity-evidence-disposal.service";
import { ProfessionalIdentityReviewService } from "../modules/users/professional-identity-review.service";
import type { StorageService } from "../storage/storage.service";
import { createIntegrationPrismaService } from "./integration-database";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("identity evidence disposal worker", () => {
  const prisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();

  beforeAll(async () => {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("The suite refuses to run outside the integration database.");
  });

  afterEach(async () => {
    const attemptIds = [...createdAttemptIds];
    if (attemptIds.length > 0) {
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "identity_evidence_disposal_tasks" WHERE "evidence_id" IN (SELECT "id" FROM "identity_verification_evidence_references" WHERE "attempt_id" IN (${Prisma.join(attemptIds)}::uuid))`);
      await prisma.$executeRaw(Prisma.sql`DELETE FROM "identity_evidence_disposal_suspension_events" WHERE "attempt_id" IN (${Prisma.join(attemptIds)}::uuid)`);
      await prisma.identityVerificationEvidenceReference.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await prisma.identityVerificationDecision.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await prisma.professionalIdentityVerificationAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    }
    if (createdIdentityIds.size) await prisma.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    if (createdProfileIds.size) await prisma.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    if (createdUserIds.size) await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    createdUserIds.clear(); createdProfileIds.clear(); createdIdentityIds.clear(); createdAttemptIds.clear();
  });

  afterAll(async () => prisma.$disconnect());

  it("keeps eligible evidence untouched while the disposal flag is off", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const fixture = await createSupersededFixture(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const worker = workerWith(false, async () => undefined);

    await worker.processBatch(now, 1);

    await expect(stateFor(fixture.evidenceId)).resolves.toMatchObject({ reference: fixture.objectKey, discardRequestedAt: null, discardedAt: null });
    await expect(taskCount(fixture.evidenceId)).resolves.toBe(0);
  });

  it("uses the exact seven-day superseded boundary and persists policy metadata", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const fixture = await createSupersededFixture(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const deleted: string[] = [];
    const worker = workerWith(true, async (key) => { deleted.push(key); });

    await worker.processBatch(new Date(now.getTime() - 1), 1);
    await expect(taskCount(fixture.evidenceId)).resolves.toBe(0);
    await worker.processBatch(now, 1);

    expect(deleted).toEqual([fixture.objectKey]);
    await expect(stateFor(fixture.evidenceId)).resolves.toMatchObject({ reference: null, discardRequestedAt: now, discardedAt: expect.any(Date) });
    await expect(taskFor(fixture.evidenceId)).resolves.toMatchObject({ policyVersion: "identity-media-v1", reason: "SUPERSEDED", status: "COMPLETED" });
  });

  it("preserves evidence during an active suspension", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const fixture = await createSupersededFixture(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
    await new ProfessionalIdentityReviewService(prisma, storage(async () => undefined)).suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Investigação");

    await workerWith(true, async () => { throw new Error("must not delete"); }).processBatch(now, 1);

    await expect(taskCount(fixture.evidenceId)).resolves.toBe(0);
    await expect(stateFor(fixture.evidenceId)).resolves.toMatchObject({ reference: fixture.objectKey, discardRequestedAt: null });
  });

  it("previews exact eligibility, suspension, pagination and no sensitive storage reference without writes", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const eligible = await createSupersededFixture(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const suspended = await createSupersededFixture(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
    const underReview = await createSupersededFixture(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
    await prisma.professionalIdentityVerificationAttempt.update({ where: { id: underReview.attemptId }, data: { status: "UNDER_REVIEW" } });
    await new ProfessionalIdentityReviewService(prisma, storage(async () => undefined)).suspendEvidenceDisposal(suspended.adminUserId, suspended.attemptId, "Investigação");
    const previewService = workerWith(false, async () => { throw new Error("preview must not call storage"); });

    const firstPage = await previewService.preview(now, 1, 2);
    const secondPage = await previewService.preview(now, 2, 2);

    expect(firstPage).toMatchObject({ policyVersion: "identity-media-v1", referenceAt: now, executionEnabled: false, pagination: { page: 1, pageSize: 2, total: 3, totalPages: 2 }, totalsByReason: { SUPERSEDED: 3 } });
    expect([...firstPage.items, ...secondPage.items].map((item) => item.evidenceId)).toEqual(expect.arrayContaining([eligible.evidenceId, suspended.evidenceId, underReview.evidenceId]));
    const eligibleItem = [...firstPage.items, ...secondPage.items].find((item) => item.evidenceId === eligible.evidenceId);
    const suspendedItem = [...firstPage.items, ...secondPage.items].find((item) => item.evidenceId === suspended.evidenceId);
    const underReviewItem = [...firstPage.items, ...secondPage.items].find((item) => item.evidenceId === underReview.evidenceId);
    expect(eligibleItem).toMatchObject({ policyEligible: true, executionEligible: true, eligibleAt: now, impediments: [] });
    expect(suspendedItem).toMatchObject({ policyEligible: true, executionEligible: false, impediments: ["DISPOSAL_SUSPENDED"] });
    expect(underReviewItem).toMatchObject({ policyEligible: true, executionEligible: false, impediments: ["UNDER_REVIEW"] });
    expect(JSON.stringify(firstPage)).not.toContain(eligible.objectKey);
    expect(JSON.stringify(firstPage)).not.toContain(suspended.objectKey);
    await expect(taskCount(eligible.evidenceId)).resolves.toBe(0);
    await expect(stateFor(eligible.evidenceId)).resolves.toMatchObject({ discardRequestedAt: null, discardedAt: null });
  });

  it("uses the exact 30-day incomplete-attempt boundary and restarts it after a new upload", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const exact = await createActiveFixture(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const renewed = await createActiveFixture(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    await prisma.identityVerificationEvidenceReference.create({ data: { attemptId: renewed.attemptId, kind: "SELFIE", reference: `integration/${randomUUID()}`, createdAt: new Date(now.getTime() - 1) } });
    const worker = workerWith(true, async () => undefined);

    await expect(worker.preview(new Date(now.getTime() - 1), 1, 50)).resolves.toMatchObject({ pagination: { total: 0 } });
    const atBoundary = await worker.preview(now, 1, 50);
    expect(atBoundary.items.find((item) => item.evidenceId === exact.evidenceId)).toMatchObject({ reason: "INCOMPLETE_ATTEMPT", eligibleAt: now, policyEligible: true, executionEligible: false, impediments: ["ATTEMPT_EXPIRATION_REQUIRED"] });
    expect(atBoundary.items.find((item) => item.attemptId === renewed.attemptId)).toBeUndefined();

    await worker.processBatch(new Date(now.getTime() - 1), 25);
    await expect(taskCount(exact.evidenceId)).resolves.toBe(0);
    await worker.processBatch(now, 25);
    await expect(stateFor(exact.evidenceId)).resolves.toMatchObject({ reference: null, discardedAt: now });
    await expect(taskCount(renewed.evidenceId)).resolves.toBe(0);
    await expect(prisma.professionalIdentityVerificationAttempt.findUniqueOrThrow({ where: { id: renewed.attemptId }, select: { status: true } })).resolves.toMatchObject({ status: "AWAITING_EVIDENCE" });
  });

  it("uses the exact 90-day closed-attempt boundary consistently in preview and worker", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const fixture = await createClosedFixture(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
    const deleted: string[] = [];
    const worker = workerWith(true, async (key) => { deleted.push(key); });

    await expect(worker.preview(new Date(now.getTime() - 1), 1, 20)).resolves.toMatchObject({ pagination: { total: 0 } });
    const atBoundary = await worker.preview(now, 1, 20);
    expect(atBoundary.items.find((item) => item.evidenceId === fixture.evidenceId)).toMatchObject({ reason: "CLOSED_ATTEMPT", eligibleAt: now, policyEligible: true, executionEligible: true, impediments: [] });
    await worker.processBatch(new Date(now.getTime() - 1), 25);
    await expect(taskCount(fixture.evidenceId)).resolves.toBe(0);
    await worker.processBatch(now, 25);
    expect(deleted).toEqual([fixture.objectKey]);
    await expect(stateFor(fixture.evidenceId)).resolves.toMatchObject({ reference: null, discardedAt: now });
  });

  it("retries storage failures and makes a concurrent suspension explicitly conflict after the irreversible point", async () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    const fixture = await createSupersededFixture(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000));
    const enteredDelete = deferred();
    const releaseDelete = deferred();
    let calls = 0;
    const worker = workerWith(true, async () => {
      calls += 1;
      if (calls === 1) { enteredDelete.resolve(); await releaseDelete.promise; throw new Error("storage unavailable"); }
    });
    const running = worker.processBatch(now, 1);
    await enteredDelete.promise;

    await expect(new ProfessionalIdentityReviewService(prisma, storage(async () => undefined)).suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Tarde demais"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_DISPOSAL_IN_PROGRESS" }) });
    releaseDelete.resolve();
    await running;
    const retryAt = new Date(now.getTime() + 60_000);
    await expect(taskFor(fixture.evidenceId)).resolves.toMatchObject({ status: "PENDING", attemptCount: 1, nextAttemptAt: retryAt, leaseExpiresAt: null, lastError: "STORAGE_DELETE_FAILED" });

    await worker.processBatch(retryAt, 1);
    expect(calls).toBe(2);
    await expect(stateFor(fixture.evidenceId)).resolves.toMatchObject({ reference: null, discardedAt: expect.any(Date) });
    await expect(taskFor(fixture.evidenceId)).resolves.toMatchObject({ status: "COMPLETED", attemptCount: 2, leaseExpiresAt: null, lastError: null });
  });

  function workerWith(enabled: boolean, remove: (key: string) => Promise<void>) {
    return new ProfessionalIdentityEvidenceDisposalService(prisma, storage(remove), new ConfigService({ IDENTITY_EVIDENCE_DISPOSAL_ENABLED: enabled ? "true" : "false" }));
  }

  function storage(remove: (key: string) => Promise<void>): StorageService {
    return { upload: async () => ({ objectKey: "unused" }), delete: remove, createTemporaryReadUrl: async () => "https://storage.example.test/unused" };
  }

  async function createSupersededFixture(supersededAt: Date | null) {
    const userId = randomUUID(), adminUserId = randomUUID(), profileId = randomUUID(), identityId = randomUUID();
    createdUserIds.add(userId); createdUserIds.add(adminUserId); createdProfileIds.add(profileId); createdIdentityIds.add(identityId);
    await createUser(userId, "professional"); await createUser(adminUserId, "admin");
    await prisma.professionalProfile.create({ data: { id: profileId, userId, displayName: "Disposal worker" } });
    await prisma.personalIdentity.create({ data: { id: identityId, userId, cpfEnvelope: {}, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "integration" } });
    const attempt = await prisma.professionalIdentityVerificationAttempt.create({ data: { professionalProfileId: profileId, personalIdentityId: identityId, requiresSelfie: false } });
    createdAttemptIds.add(attempt.id);
    const objectKey = `integration/${randomUUID()}`;
    const evidence = await prisma.identityVerificationEvidenceReference.create({ data: { attemptId: attempt.id, kind: "DOCUMENT", reference: objectKey, supersededAt } });
    return { adminUserId, attemptId: attempt.id, evidenceId: evidence.id, objectKey };
  }

  async function createActiveFixture(createdAt: Date) {
    const fixture = await createSupersededFixture(null);
    await prisma.$executeRaw(Prisma.sql`UPDATE "identity_verification_evidence_references" SET "superseded_at" = NULL, "created_at" = ${createdAt} WHERE "id" = ${fixture.evidenceId}::uuid`);
    return fixture;
  }

  async function createClosedFixture(decisionAt: Date) {
    const fixture = await createActiveFixture(decisionAt);
    await prisma.professionalIdentityVerificationAttempt.update({ where: { id: fixture.attemptId }, data: { status: "CLOSED", result: "NOT_CONFIRMED", closedAt: decisionAt } });
    await prisma.identityVerificationDecision.create({ data: { attemptId: fixture.attemptId, source: "MANUAL", result: "NOT_CONFIRMED", reasonCode: "DATA_MISMATCH", criteriaVersion: "integration", operatorUserId: fixture.adminUserId, createdAt: decisionAt } });
    return fixture;
  }

  async function createUser(id: string, name: string) {
    const email = `${name}-${id}@example.test`;
    await prisma.user.create({ data: { id, name, email, emailNormalized: email, passwordHash: "integration", status: UserStatus.ACTIVE } });
  }

  async function stateFor(evidenceId: string) {
    const [row] = await prisma.$queryRaw<Array<{ reference: string | null; discardRequestedAt: Date | null; discardedAt: Date | null }>>(Prisma.sql`SELECT "reference", "discard_requested_at" AS "discardRequestedAt", "discarded_at" AS "discardedAt" FROM "identity_verification_evidence_references" WHERE "id" = ${evidenceId}::uuid`);
    return row;
  }
  async function taskFor(evidenceId: string) {
    const [row] = await prisma.$queryRaw<Array<{ policyVersion: string; reason: string; status: string; attemptCount: number; nextAttemptAt: Date; leaseExpiresAt: Date | null; lastError: string | null }>>(Prisma.sql`SELECT "policy_version" AS "policyVersion", "reason", "status"::text, "attempt_count" AS "attemptCount", "next_attempt_at" AS "nextAttemptAt", "lease_expires_at" AS "leaseExpiresAt", "last_error" AS "lastError" FROM "identity_evidence_disposal_tasks" WHERE "evidence_id" = ${evidenceId}::uuid`);
    return row;
  }
  async function taskCount(evidenceId: string) {
    const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`SELECT count(*) FROM "identity_evidence_disposal_tasks" WHERE "evidence_id" = ${evidenceId}::uuid`);
    return Number(row.count);
  }
});
