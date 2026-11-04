import { randomUUID } from "node:crypto";

import { IdentityEvidenceDisposalTaskStatus, Prisma, UserStatus } from "../generated/prisma/client";
import { ProfessionalIdentityEvidenceDisposalService } from "../modules/users/professional-identity-evidence-disposal.service";
import type { StorageService } from "../storage/storage.service";
import { createIntegrationPrismaService } from "./integration-database";

describe("identity evidence disposal task monitoring", () => {
  const prisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();
  const createdEvidenceIds = new Set<string>();
  const createdTaskIds = new Set<string>();
  const storage: StorageService = { upload: jest.fn(async () => ({ objectKey: "integration/unused" })), delete: jest.fn(async () => undefined), createTemporaryReadUrl: jest.fn(async () => "https://storage.example.test/unused") };
  const service = new ProfessionalIdentityEvidenceDisposalService(prisma, storage);

  beforeAll(async () => {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("The suite refuses to run outside the integration database.");
  });

  afterEach(async () => {
    if (createdTaskIds.size) await prisma.identityEvidenceDisposalTask.deleteMany({ where: { id: { in: [...createdTaskIds] } } });
    if (createdEvidenceIds.size) await prisma.identityVerificationEvidenceReference.deleteMany({ where: { id: { in: [...createdEvidenceIds] } } });
    if (createdAttemptIds.size) await prisma.professionalIdentityVerificationAttempt.deleteMany({ where: { id: { in: [...createdAttemptIds] } } });
    if (createdIdentityIds.size) await prisma.personalIdentity.deleteMany({ where: { id: { in: [...createdIdentityIds] } } });
    if (createdProfileIds.size) await prisma.professionalProfile.deleteMany({ where: { id: { in: [...createdProfileIds] } } });
    if (createdUserIds.size) await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
    createdUserIds.clear(); createdProfileIds.clear(); createdIdentityIds.clear(); createdAttemptIds.clear(); createdEvidenceIds.clear(); createdTaskIds.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => prisma.$disconnect());

  it("lists the existing task statuses and filters each one", async () => {
    const statuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
    const fixtures = await Promise.all(statuses.map((status, index) => createTask(status, new Date(`2026-11-03T10:0${index}:00.000Z`))));

    const all = await service.listTasks(1, 20);
    expect(all.items.map((item) => item.status)).toEqual(expect.arrayContaining(statuses));
    for (const status of statuses) {
      const filtered = await service.listTasks(1, 20, status);
      expect(filtered.items.find((item) => item.id === fixtures.find((fixture) => fixture.status === status)?.taskId)).toMatchObject({ status });
    }
    await expect(service.listTasks(1, 20, "FAILED" as IdentityEvidenceDisposalTaskStatus)).resolves.toMatchObject({ pagination: { total: 1 } });
  });

  it("uses deterministic pagination without duplicates or omissions", async () => {
    const fixtures = await Promise.all(Array.from({ length: 5 }, (_, index) => createTask("PENDING", new Date(`2026-11-03T11:0${index}:00.000Z`))));
    const first = await service.listTasks(1, 2, "PENDING");
    const second = await service.listTasks(2, 2, "PENDING");
    const third = await service.listTasks(3, 2, "PENDING");
    const observed = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    const expected = [...fixtures].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).map((fixture) => fixture.taskId);

    expect(first.pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    expect(observed).toEqual(expected);
    expect(new Set(observed).size).toBe(5);
  });

  it("returns an empty response for a status without fixtures", async () => {
    await expect(service.listTasks(1, 10, "FAILED")).resolves.toEqual({ items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
  });

  it("does not expose sensitive fields, mutate data, or call storage", async () => {
    const fixture = await createTask("FAILED", new Date("2026-11-03T12:00:00.000Z"));
    const before = await stateFor(fixture.taskId, fixture.evidenceId);

    const result = await service.listTasks(1, 10, "FAILED");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(fixture.objectKey);
    expect(serialized).not.toContain(fixture.reference);
    expect(serialized).not.toContain(fixture.lastError);
    expect(serialized).not.toContain(fixture.cpfMarker);
    expect(serialized).not.toContain("https://");
    expect(await stateFor(fixture.taskId, fixture.evidenceId)).toEqual(before);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });

  async function createTask(status: IdentityEvidenceDisposalTaskStatus, createdAt: Date) {
    const userId = randomUUID(), profileId = randomUUID(), identityId = randomUUID(), attemptId = randomUUID(), evidenceId = randomUUID(), taskId = randomUUID();
    const objectKey = `integration/private/${randomUUID()}`;
    const reference = `reference-${randomUUID()}`;
    const lastError = `RAW_STORAGE_ERROR_${randomUUID()}`;
    const cpfMarker = "52998224725";
    createdUserIds.add(userId); createdProfileIds.add(profileId); createdIdentityIds.add(identityId); createdAttemptIds.add(attemptId); createdEvidenceIds.add(evidenceId); createdTaskIds.add(taskId);
    const email = `monitor-${userId}@example.test`;
    await prisma.user.create({ data: { id: userId, name: "monitor", email, emailNormalized: email, passwordHash: "integration", status: UserStatus.ACTIVE } });
    await prisma.professionalProfile.create({ data: { id: profileId, userId, displayName: "Task monitor" } });
    await prisma.personalIdentity.create({ data: { id: identityId, userId, cpfEnvelope: { marker: cpfMarker }, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "integration" } });
    await prisma.professionalIdentityVerificationAttempt.create({ data: { id: attemptId, professionalProfileId: profileId, personalIdentityId: identityId } });
    await prisma.identityVerificationEvidenceReference.create({ data: { id: evidenceId, attemptId, kind: "DOCUMENT", reference } });
    await prisma.identityEvidenceDisposalTask.create({ data: { id: taskId, evidenceId, objectKey, policyVersion: "identity-media-v1", reason: "SUPERSEDED", eligibleAt: createdAt, status, attemptCount: status === "PROCESSING" ? 2 : 1, nextAttemptAt: createdAt, leaseExpiresAt: status === "PROCESSING" ? new Date(createdAt.getTime() + 60_000) : null, irreversibleStartedAt: status === "PROCESSING" ? createdAt : null, completedAt: status === "COMPLETED" || status === "FAILED" ? createdAt : null, lastError: status === "FAILED" ? lastError : null, createdAt, updatedAt: createdAt } });
    return { taskId, evidenceId, status, createdAt, objectKey, reference, lastError, cpfMarker };
  }

  async function stateFor(taskId: string, evidenceId: string) {
    const task = await prisma.identityEvidenceDisposalTask.findUniqueOrThrow({ where: { id: taskId }, select: { status: true, attemptCount: true, objectKey: true, nextAttemptAt: true, leaseExpiresAt: true, irreversibleStartedAt: true, completedAt: true, lastError: true, updatedAt: true } });
    const evidence = await prisma.identityVerificationEvidenceReference.findUniqueOrThrow({ where: { id: evidenceId }, select: { reference: true, discardRequestedAt: true, discardStartedAt: true, discardedAt: true } });
    return { task, evidence };
  }
});
