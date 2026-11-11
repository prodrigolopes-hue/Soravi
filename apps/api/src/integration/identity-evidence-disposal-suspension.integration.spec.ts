import { randomUUID } from "node:crypto";

import { Prisma, UserStatus } from "../generated/prisma/client";
import { ProfessionalIdentityReviewService } from "../modules/users/professional-identity-review.service";
import type { StorageService } from "../storage/storage.service";
import { createIntegrationPrismaService } from "./integration-database";

type EvidenceState = {
  discardRequestedAt: Date | null;
  discardedAt: Date | null;
};

type SuspensionEvent = {
  action: string;
  reason: string;
  operatorUserId: string;
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("identity evidence disposal suspension", () => {
  const control = createIntegrationPrismaService();
  const first = createIntegrationPrismaService();
  const second = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();
  const storage: StorageService = {
    upload: async () => ({ objectKey: "integration/unused" }),
    delete: async () => undefined,
    createTemporaryReadUrl: async () => "https://storage.example.test/unused",
  };

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    const [database] = await control.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("The suite refuses to run outside the integration database.");
    }
  });

  afterEach(async () => {
    const attemptIds = [...createdAttemptIds];
    if (attemptIds.length > 0) {
      await control.$executeRaw(
        Prisma.sql`DELETE FROM "identity_evidence_disposal_suspension_events" WHERE "attempt_id" IN (${Prisma.join(attemptIds)}::uuid)`,
      );
      await control.identityVerificationEvidenceReference.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });
      await control.identityVerificationDecision.deleteMany({
        where: { attemptId: { in: attemptIds } },
      });
      await control.professionalIdentityVerificationAttempt.deleteMany({
        where: { id: { in: attemptIds } },
      });
    }
    if (createdIdentityIds.size > 0) {
      await control.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    }
    if (createdProfileIds.size > 0) {
      await control.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    }
    if (createdUserIds.size > 0) {
      await control.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    }
    createdUserIds.clear();
    createdProfileIds.clear();
    createdIdentityIds.clear();
    createdAttemptIds.clear();
  });

  afterAll(async () => {
    await Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]);
  });

  it("preserves APPLIED and RELEASED events", async () => {
    const fixture = await createFixture();
    const review = new ProfessionalIdentityReviewService(first, storage);

    await review.suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Investiga\u00e7\u00e3o aberta");
    await review.releaseEvidenceDisposalSuspension(fixture.adminUserId, fixture.attemptId, "Investiga\u00e7\u00e3o encerrada");

    await expect(eventsFor(fixture.attemptId)).resolves.toEqual([
      { action: "APPLIED", reason: "Investiga\u00e7\u00e3o aberta", operatorUserId: fixture.adminUserId },
      { action: "RELEASED", reason: "Investiga\u00e7\u00e3o encerrada", operatorUserId: fixture.adminUserId },
    ]);
  });

  it("does not mark evidence pending or discarded while disposal is suspended", async () => {
    const fixture = await createFixture();
    const review = new ProfessionalIdentityReviewService(first, storage);
    await review.suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Disputa em an\u00e1lise");

    await expect(review.markEvidenceDisposalPending(fixture.attemptId, "DOCUMENT"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED" }) });
    await expect(review.markEvidenceDiscarded(fixture.attemptId, "DOCUMENT"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED" }) });
    await expect(evidenceState(fixture.evidenceId)).resolves.toEqual({ discardRequestedAt: null, discardedAt: null });
  });

  it("rolls back the suspension when its event insert fails", async () => {
    const fixture = await createFixture();
    const review = new ProfessionalIdentityReviewService(first, storage);

    await expect(review.suspendEvidenceDisposal(randomUUID(), fixture.attemptId, "Operador inexistente"))
      .rejects.toThrow();

    await expect(eventsFor(fixture.attemptId)).resolves.toEqual([]);
    await expect(evidenceState(fixture.evidenceId)).resolves.toEqual({ discardRequestedAt: null, discardedAt: null });
  });

  it("serializes a concurrent suspension and disposal request, and blocks completion when the hold follows the pending state", async () => {
    const fixture = await createFixture();
    const suspensionReview = new ProfessionalIdentityReviewService(first, storage);
    const disposalReview = new ProfessionalIdentityReviewService(second, storage);
    const start = deferred();

    const suspension = (async () => {
      await start.promise;
      return suspensionReview.suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Disputa concorrente");
    })();
    const pending = (async () => {
      await start.promise;
      return disposalReview.markEvidenceDisposalPending(fixture.attemptId, "DOCUMENT");
    })();
    start.resolve();

    const [suspensionResult, pendingResult] = await Promise.allSettled([suspension, pending]);
    expect(suspensionResult.status).toBe("fulfilled");

    const state = await evidenceState(fixture.evidenceId);
    if (pendingResult.status === "fulfilled") {
      expect(state.discardRequestedAt).toBeInstanceOf(Date);
      expect(state.discardedAt).toBeNull();
      await expect(disposalReview.markEvidenceDiscarded(fixture.attemptId, "DOCUMENT"))
        .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED" }) });
      await expect(evidenceState(fixture.evidenceId)).resolves.toMatchObject({ discardedAt: null });
    } else {
      expect(pendingResult.reason).toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_DISPOSAL_SUSPENDED" }) });
      expect(state).toEqual({ discardRequestedAt: null, discardedAt: null });
    }
  });

  it("does not restore discarded evidence when suspension is requested", async () => {
    const fixture = await createFixture();
    const review = new ProfessionalIdentityReviewService(first, storage);
    await control.$executeRaw(
      Prisma.sql`UPDATE "identity_verification_evidence_references" SET "discard_requested_at" = NOW(), "discarded_at" = NOW() WHERE "id" = ${fixture.evidenceId}::uuid`,
    );

    await expect(review.suspendEvidenceDisposal(fixture.adminUserId, fixture.attemptId, "Solicita\u00e7\u00e3o tardia"))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_ALREADY_DISCARDED" }) });

    const state = await evidenceState(fixture.evidenceId);
    expect(state.discardRequestedAt).toBeInstanceOf(Date);
    expect(state.discardedAt).toBeInstanceOf(Date);
    await expect(eventsFor(fixture.attemptId)).resolves.toEqual([]);
  });

  async function createFixture() {
    const userId = randomUUID();
    const adminUserId = randomUUID();
    const profileId = randomUUID();
    const identityId = randomUUID();
    createdUserIds.add(userId);
    createdUserIds.add(adminUserId);
    createdProfileIds.add(profileId);
    createdIdentityIds.add(identityId);
    await createUser(userId, "professional");
    await createUser(adminUserId, "admin");
    await control.professionalProfile.create({ data: { id: profileId, userId, displayName: "Disposal integration" } });
    await control.personalIdentity.create({
      data: { id: identityId, userId, cpfEnvelope: {}, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "integration" },
    });
    const attempt = await control.professionalIdentityVerificationAttempt.create({
      data: { professionalProfileId: profileId, personalIdentityId: identityId, requiresSelfie: false },
    });
    createdAttemptIds.add(attempt.id);
    const evidence = await control.identityVerificationEvidenceReference.create({
      data: { attemptId: attempt.id, kind: "DOCUMENT", reference: `integration/${randomUUID()}` },
    });
    return { adminUserId, attemptId: attempt.id, evidenceId: evidence.id };
  }

  async function createUser(id: string, kind: string): Promise<void> {
    const email = `${kind}-${id}@example.test`;
    await control.user.create({
      data: { id, name: kind, email, emailNormalized: email, passwordHash: "integration", status: UserStatus.ACTIVE },
    });
  }

  async function eventsFor(attemptId: string): Promise<SuspensionEvent[]> {
    return control.$queryRaw<SuspensionEvent[]>(Prisma.sql`
      SELECT "action", "reason", "operator_user_id" AS "operatorUserId"
      FROM "identity_evidence_disposal_suspension_events"
      WHERE "attempt_id" = ${attemptId}::uuid
      ORDER BY "created_at" ASC, "id" ASC
    `);
  }

  async function evidenceState(evidenceId: string): Promise<EvidenceState> {
    const [state] = await control.$queryRaw<EvidenceState[]>(Prisma.sql`
      SELECT "discard_requested_at" AS "discardRequestedAt", "discarded_at" AS "discardedAt"
      FROM "identity_verification_evidence_references"
      WHERE "id" = ${evidenceId}::uuid
    `);
    if (!state) throw new Error("Fixture evidence was not found.");
    return state;
  }
});
