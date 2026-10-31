import { Prisma } from "../generated/prisma/client";
import { createIntegrationPrismaService } from "./integration-database";
import { reserveServiceRequestPublicCode } from "../modules/service-requests/service-request-public-code";

describe("public code PostgreSQL concurrency", () => {
  const prisma = createIntegrationPrismaService();
  const year = 2199;
  let ownsCounter = false;

  beforeAll(async () => {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<{ name: string }[]>(
      Prisma.sql`SELECT current_database() AS name`,
    );
    if (database.name !== "soravi_integration_test") {
      throw new Error("Integration database only.");
    }
  });

  afterAll(async () => {
    try {
      if (ownsCounter) {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM "service_request_public_code_counters" WHERE "year" = ${year}`,
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  it("reserves 12 distinct consecutive codes through concurrent transactions", async () => {
    const existing = await prisma.$queryRaw<{ year: number }[]>(
      Prisma.sql`SELECT "year" FROM "service_request_public_code_counters" WHERE "year" = ${year}`,
    );
    if (existing.length) {
      throw new Error("Test year already exists; no existing counter was changed.");
    }

    ownsCounter = true;
    const codes = await Promise.all(
      Array.from({ length: 12 }, () =>
        prisma.$transaction(
          (transaction) =>
            reserveServiceRequestPublicCode(
              transaction,
              new Date("2199-06-01T12:00:00.000Z"),
            ),
          { maxWait: 30000, timeout: 30000 },
        ),
      ),
    );

    expect(new Set(codes).size).toBe(12);
    expect([...codes].sort()).toEqual(
      Array.from({ length: 12 }, (_, index) =>
        `SO2199${String(index + 1).padStart(3, "0")}`,
      ),
    );

    const [counter] = await prisma.$queryRaw<{ sequence: number }[]>(
      Prisma.sql`SELECT "last_sequence" AS sequence FROM "service_request_public_code_counters" WHERE "year" = ${year}`,
    );
    expect(counter.sequence).toBe(12);
  });
});
