import { randomUUID } from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import { createIntegrationPrismaService } from "./integration-database";
import { ProfessionalIdentityDocumentService } from "../modules/users/professional-identity-document.service";

describe("identity document orphan cleanup migration", () => {
  const prisma = createIntegrationPrismaService();
  const keys = new Set<string>();
  const storage = { upload: jest.fn(), delete: jest.fn(), createTemporaryReadUrl: jest.fn() };

  beforeAll(async () => {
    await prisma.$connect();
    const [row] = await prisma.$queryRaw<{ current_database: string }[]>(Prisma.sql`SELECT current_database()`);
    if (row?.current_database !== "soravi_integration_test") throw new Error("Integration database only.");
  });
  afterEach(async () => {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "identity_document_cleanup_tasks" WHERE "object_key" IN (${Prisma.join([...keys])})`);
    keys.clear(); jest.clearAllMocks();
  });
  afterAll(async () => prisma.$disconnect());

  it("recovers late uploads, deletion failures, expired leases and concurrent processors", async () => {
    const now = new Date();
    const late = await task("late", "COMPLETED", new Date(now.getTime() - 1));
    const failed = await task("failed", "PENDING", new Date(now.getTime() - 1));
    const leased = await task("leased", "PROCESSING", new Date(now.getTime() - 1));
    const concurrent = await task("concurrent", "PENDING", new Date(now.getTime() - 1));
    storage.delete.mockImplementation(async (key: string) => {
      if (key === failed) throw new Error("storage unavailable");
    });
    const first = new ProfessionalIdentityDocumentService(prisma, storage as never);
    const second = new ProfessionalIdentityDocumentService(prisma, storage as never);
    await Promise.all([first.processCleanupBatch(now, 25), second.processCleanupBatch(now, 25)]);

    expect(storage.delete).toHaveBeenCalledWith(late);
    expect(storage.delete).toHaveBeenCalledWith(leased);
    expect(storage.delete.mock.calls.filter(([key]: [string]) => key === concurrent)).toHaveLength(1);
    const [failedRow] = await prisma.$queryRaw<{ status: string; attemptCount: number }[]>(Prisma.sql`SELECT "status", "attempt_count" AS "attemptCount" FROM "identity_document_cleanup_tasks" WHERE "object_key" = ${failed}`);
    expect(failedRow).toMatchObject({ status: "PENDING", attemptCount: 1 });
  });

  async function task(label: string, status: "PENDING" | "PROCESSING" | "COMPLETED", nextAttemptAt: Date): Promise<string> {
    const key = `private/integration-identity-document/${label}-${randomUUID()}.webp`;
    keys.add(key);
    await prisma.$executeRaw(Prisma.sql`INSERT INTO "identity_document_cleanup_tasks" ("id", "object_key", "status", "attempt_count", "next_attempt_at", "lease_expires_at", "created_at", "updated_at") VALUES (${randomUUID()}::uuid, ${key}, ${status}::"IdentityDocumentCleanupStatus", 0, ${nextAttemptAt}, ${status === "PROCESSING" ? nextAttemptAt : null}, ${new Date()}, ${new Date()})`);
    return key;
  }
});
