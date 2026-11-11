import { randomUUID } from "node:crypto";

import { Prisma, UserStatus } from "../generated/prisma/client";
import { createIntegrationPrismaService } from "./integration-database";

describe("identity document association versus cleanup", () => {
  const control = createIntegrationPrismaService();
  const associator = createIntegrationPrismaService();
  const cleaner = createIntegrationPrismaService();
  const userIds = new Set<string>();
  const profileIds = new Set<string>();
  const identityIds = new Set<string>();
  const attemptIds = new Set<string>();
  const keys = new Set<string>();

  beforeAll(async () => {
    await Promise.all([control.$connect(), associator.$connect(), cleaner.$connect()]);
    const [database] = await control.$queryRaw<{ current_database: string }[]>(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") throw new Error("Integration database only.");
  });
  afterEach(async () => {
    await control.identityVerificationEvidenceReference.deleteMany({ where: { attemptId: { in: [...attemptIds] } } });
    await control.professionalIdentityVerificationAttempt.deleteMany({ where: { id: { in: [...attemptIds] } } });
    await control.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" IN (${Prisma.join([...keys])})`);
    await control.personalIdentity.deleteMany({ where: { id: { in: [...identityIds] } } });
    await control.professionalProfile.deleteMany({ where: { id: { in: [...profileIds] } } });
    await control.user.deleteMany({ where: { id: { in: [...userIds] } } });
    userIds.clear(); profileIds.clear(); identityIds.clear(); attemptIds.clear(); keys.clear();
  });
  afterAll(async () => Promise.all([control.$disconnect(), associator.$disconnect(), cleaner.$disconnect()]));

  it("preserva o documento quando a associação vence o lock", async () => {
    const fixture = await createFixture();
    const entered = deferred<void>(); const release = deferred<void>();
    const association = associator.$transaction(async (tx) => {
      const [candidate] = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`SELECT "status" FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key} FOR UPDATE`);
      expect(candidate.status).toBe("PENDING"); entered.resolve(); await release.promise;
      await tx.identityVerificationEvidenceReference.create({ data: { attemptId: fixture.attemptId, kind: "DOCUMENT", reference: fixture.key } });
      await tx.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key}`);
    });
    await entered.promise;
    const cleanup = cleaner.$transaction((tx) => tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key} FOR UPDATE SKIP LOCKED`));
    release.resolve();
    const [claim] = await cleanup; await association;
    expect(claim).toBeUndefined();
    expect(await control.identityVerificationEvidenceReference.count({ where: { attemptId: fixture.attemptId, reference: fixture.key } })).toBe(1);
    expect(await control.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*) FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key}`)).toEqual([{ count: 0n }]);
  });

  it("recusa associação quando a limpeza já reivindicou o candidato", async () => {
    const fixture = await createFixture();
    const entered = deferred<void>(); const release = deferred<void>();
    const cleanup = cleaner.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key} FOR UPDATE`);
      entered.resolve(); await release.promise;
      await tx.$executeRaw(Prisma.sql`UPDATE "identity_document_cleanup_tasks" SET "status" = 'PROCESSING'::"IdentityDocumentCleanupStatus" WHERE "object_key" = ${fixture.key}`);
    });
    await entered.promise;
    const association = associator.$transaction(async (tx) => {
      const [candidate] = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`SELECT "status" FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${fixture.key} FOR UPDATE`);
      return candidate.status === "PENDING";
    });
    release.resolve(); await cleanup;
    expect(await association).toBe(false);
    expect(await control.identityVerificationEvidenceReference.count({ where: { attemptId: fixture.attemptId } })).toBe(0);
  });

  async function createFixture() {
    const userId = randomUUID(), profileId = randomUUID(), identityId = randomUUID(), attemptId = randomUUID();
    const key = `private/race/${randomUUID()}.webp`; userIds.add(userId); profileIds.add(profileId); identityIds.add(identityId); attemptIds.add(attemptId); keys.add(key);
    const email = `${userId}@example.test`;
    await control.user.create({ data: { id: userId, name: "Race", email, emailNormalized: email, passwordHash: "x", status: UserStatus.ACTIVE } });
    await control.professionalProfile.create({ data: { id: profileId, userId, displayName: "Race" } });
    await control.personalIdentity.create({ data: { id: identityId, userId, cpfEnvelope: {}, cpfHmac: randomUUID().replaceAll("-", ""), hmacKeyId: "test" } });
    await control.professionalIdentityVerificationAttempt.create({ data: { id: attemptId, professionalProfileId: profileId, personalIdentityId: identityId } });
    await control.$executeRaw(Prisma.sql`INSERT INTO "identity_document_cleanup_tasks" ("id", "object_key", "status", "attempt_count", "next_attempt_at", "created_at", "updated_at") VALUES (${randomUUID()}::uuid, ${key}, 'PENDING'::"IdentityDocumentCleanupStatus", 0, ${new Date()}, ${new Date()}, ${new Date()})`);
    return { key, attemptId };
  }
});

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }
