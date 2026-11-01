import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type sharpFactory from "sharp";

import {
  Prisma,
  ProfessionalIdentityVerificationAttemptStatus,
  UserStatus,
} from "../generated/prisma/client";
import { ProfessionalIdentityDocumentService } from "../modules/users/professional-identity-document.service";
import { ProfessionalIdentityReviewService } from "../modules/users/professional-identity-review.service";
import { createIntegrationPrismaService } from "./integration-database";

const sharp: typeof sharpFactory = require("sharp");

describe("professional identity selfie concurrency", () => {
  const control = createIntegrationPrismaService();
  const first = createIntegrationPrismaService();
  const second = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();
  const uploadedKeys = new Set<string>();
  let image: Buffer;

  beforeAll(async () => {
    await Promise.all([control.$connect(), first.$connect(), second.$connect()]);
    const [database] = await control.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("The suite refuses to run outside the integration database.");
    image = await sharp({ create: { width: 320, height: 200, channels: 3, background: "#ffffff" } }).png().toBuffer();
  });

  afterEach(async () => {
    const fixtureAttemptIds = createdProfileIds.size === 0
      ? []
      : (await control.professionalIdentityVerificationAttempt.findMany({ where: { professionalProfileId: { in: [...createdProfileIds] } }, select: { id: true } })).map((attempt) => attempt.id);
    const attemptIds = [...new Set([...createdAttemptIds, ...fixtureAttemptIds])];
    if (attemptIds.length > 0) {
      await control.identityVerificationEvidenceReference.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await control.identityVerificationDecision.deleteMany({ where: { attemptId: { in: attemptIds } } });
      await control.professionalIdentityVerificationAttempt.deleteMany({ where: { id: { in: attemptIds } } });
    }
    if (uploadedKeys.size > 0) await control.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" IN (${Prisma.join([...uploadedKeys])})`);
    if (createdIdentityIds.size > 0) await control.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    if (createdProfileIds.size > 0) await control.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    if (createdUserIds.size > 0) await control.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    createdUserIds.clear(); createdProfileIds.clear(); createdIdentityIds.clear(); createdAttemptIds.clear(); uploadedKeys.clear();
  });

  afterAll(async () => Promise.all([control.$disconnect(), first.$disconnect(), second.$disconnect()]));

  it("keeps one attempt and reaches UNDER_REVIEW only after concurrent document and selfie uploads", async () => {
    const fixture = await createFixture();
    const storage = synchronizedStorage(2);
    const [documents, selfies] = documentServices(storage);

    await Promise.all([
      documents.submitCurrent(fixture.userId, uploadInput()),
      selfies.submitSelfie(fixture.userId, uploadInput()),
    ]);

    const attempts = await control.professionalIdentityVerificationAttempt.findMany({
      where: { professionalProfileId: fixture.profileId }, include: { evidenceReferences: true },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW, requiresSelfie: true });
    expect(attempts[0].evidenceReferences.filter((evidence) => evidence.supersededAt === null && evidence.kind === "DOCUMENT")).toHaveLength(1);
    expect(attempts[0].evidenceReferences.filter((evidence) => evidence.supersededAt === null && evidence.kind === "SELFIE")).toHaveLength(1);
  });

  it("keeps one active document and preserves its superseded predecessor for concurrent uploads of the same type", async () => {
    const fixture = await createFixture();
    const storage = synchronizedStorage(2);
    const [firstDocuments, secondDocuments] = documentServices(storage);

    await Promise.all([
      firstDocuments.submitCurrent(fixture.userId, uploadInput()),
      secondDocuments.submitCurrent(fixture.userId, uploadInput()),
    ]);

    const attempt = await control.professionalIdentityVerificationAttempt.findFirstOrThrow({
      where: { professionalProfileId: fixture.profileId }, include: { evidenceReferences: true },
    });
    const documents = attempt.evidenceReferences.filter((evidence) => evidence.kind === "DOCUMENT");
    expect(attempt.status).toBe(ProfessionalIdentityVerificationAttemptStatus.AWAITING_EVIDENCE);
    expect(documents.filter((evidence) => evidence.supersededAt === null)).toHaveLength(1);
    expect(documents.filter((evidence) => evidence.supersededAt !== null)).toHaveLength(1);
  });

  it("does not decide incomplete evidence, duplicate a decision, or replace evidence after review closes", async () => {
    const fixture = await createFixture({ requiresSelfie: true });
    const attempt = await createUnderReviewAttemptWithDocument(fixture);
    const storage = plainStorage();
    const [documentService, selfieService] = documentServices(storage);
    const review = new ProfessionalIdentityReviewService(first, storage as never);

    const incomplete = await Promise.allSettled([
      review.decide(fixture.adminUserId, attempt.id, { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" }),
      selfieService.submitSelfie(fixture.userId, uploadInput()),
    ]);
    expect(incomplete.every((result) => result.status === "rejected")).toBe(true);
    expect(await control.identityVerificationDecision.count({ where: { attemptId: attempt.id } })).toBe(0);
    expect(await control.identityVerificationEvidenceReference.count({ where: { attemptId: attempt.id, kind: "SELFIE", supersededAt: null } })).toBe(0);
    await expect(documentService.submitCurrent(fixture.userId, uploadInput())).rejects.toMatchObject({ response: expect.objectContaining({ code: "PROFESSIONAL_IDENTITY_DOCUMENT_ALREADY_SUBMITTED" }) });
    expect(await control.identityVerificationEvidenceReference.count({ where: { attemptId: attempt.id, kind: "DOCUMENT", supersededAt: null } })).toBe(1);

    await control.identityVerificationEvidenceReference.create({ data: { attemptId: attempt.id, kind: "SELFIE", reference: `integration/${randomUUID()}` } });
    const concurrentDecisions = await Promise.allSettled([
      new ProfessionalIdentityReviewService(first, storage as never).decide(fixture.adminUserId, attempt.id, { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" }),
      new ProfessionalIdentityReviewService(second, storage as never).decide(fixture.adminUserId, attempt.id, { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" }),
    ]);
    expect(concurrentDecisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await control.identityVerificationDecision.count({ where: { attemptId: attempt.id } })).toBe(1);

    await expect(documentService.submitCurrent(fixture.userId, uploadInput())).rejects.toMatchObject({ response: expect.objectContaining({ code: "PROFESSIONAL_IDENTITY_ALREADY_CONFIRMED" }) });
    expect(await control.identityVerificationEvidenceReference.count({ where: { attemptId: attempt.id, kind: "DOCUMENT", supersededAt: null } })).toBe(1);
  });

  function documentServices(storage: ReturnType<typeof plainStorage>): [ProfessionalIdentityDocumentService, ProfessionalIdentityDocumentService] {
    const config = new ConfigService({ PROFESSIONAL_IDENTITY_SELFIE_ENABLED: "true" });
    return [
      new ProfessionalIdentityDocumentService(first, storage as never, config),
      new ProfessionalIdentityDocumentService(second, storage as never, config),
    ];
  }

  function plainStorage() {
    return {
      upload: jest.fn(async ({ objectKey }: { objectKey: string }) => { uploadedKeys.add(objectKey); }),
      delete: jest.fn(async (objectKey: string) => { uploadedKeys.delete(objectKey); }),
      createTemporaryReadUrl: jest.fn(),
    };
  }

  function synchronizedStorage(participants: number) {
    const storage = plainStorage();
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    storage.upload.mockImplementation(async ({ objectKey }: { objectKey: string }) => {
      uploadedKeys.add(objectKey);
      arrived += 1;
      if (arrived === participants) release();
      await barrier;
    });
    return storage;
  }

  function uploadInput() {
    return { buffer: image, declaredMimeType: "image/png" };
  }

  async function createFixture(options: { requiresSelfie?: boolean } = {}) {
    const userId = randomUUID(), profileId = randomUUID(), identityId = randomUUID(), adminUserId = randomUUID();
    createdUserIds.add(userId); createdUserIds.add(adminUserId); createdProfileIds.add(profileId); createdIdentityIds.add(identityId);
    await createUser(userId, "professional"); await createUser(adminUserId, "admin");
    await control.professionalProfile.create({ data: { id: profileId, userId, displayName: "Selfie integration" } });
    await control.personalIdentity.create({ data: { id: identityId, userId, cpfEnvelope: {}, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "integration" } });
    return { userId, profileId, identityId, adminUserId, requiresSelfie: options.requiresSelfie ?? true };
  }

  async function createUser(id: string, kind: string) {
    const email = `${kind}-${id}@example.test`;
    await control.user.create({ data: { id, name: kind, email, emailNormalized: email, passwordHash: "integration", status: UserStatus.ACTIVE } });
  }

  async function createUnderReviewAttemptWithDocument(fixture: Awaited<ReturnType<typeof createFixture>>) {
    const attempt = await control.professionalIdentityVerificationAttempt.create({ data: { professionalProfileId: fixture.profileId, personalIdentityId: fixture.identityId, requiresSelfie: fixture.requiresSelfie } });
    createdAttemptIds.add(attempt.id);
    await control.identityVerificationEvidenceReference.create({ data: { attemptId: attempt.id, kind: "DOCUMENT", reference: `integration/${randomUUID()}` } });
    await control.professionalIdentityVerificationAttempt.update({ where: { id: attempt.id }, data: { status: ProfessionalIdentityVerificationAttemptStatus.UNDER_REVIEW } });
    return attempt;
  }
});
