import { randomUUID } from "node:crypto";

import {
  IdentityVerificationDecisionSource,
  IdentityVerificationResult,
  Prisma,
  ProfessionalIdentityVerificationAttemptStatus,
  UserStatus,
} from "../generated/prisma/client";
import { createIntegrationPrismaService } from "./integration-database";

describe("Professional identity verification database constraints", () => {
  const prisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const createdProfileIds = new Set<string>();
  const createdIdentityIds = new Set<string>();
  const createdAttemptIds = new Set<string>();

  beforeAll(async () => {
    await prisma.$connect();
    const [database] = await prisma.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("The suite refuses to run outside the integration database.");
    }
  });

  afterEach(async () => {
    // Delete dependents before their referenced rows. This also makes a failed
    // RESTRICT assertion harmless for the cleanup that follows it.
    await prisma.identityVerificationEvidenceReference.deleteMany({
      where: { attemptId: { in: [...createdAttemptIds] } },
    });
    await prisma.identityVerificationDecision.deleteMany({
      where: { attemptId: { in: [...createdAttemptIds] } },
    });
    await prisma.professionalIdentityVerificationAttempt.deleteMany({
      where: { id: { in: [...createdAttemptIds] } },
    });
    await prisma.personalIdentity.deleteMany({
      where: { id: { in: [...createdIdentityIds] } },
    });
    await prisma.professionalProfile.deleteMany({
      where: { id: { in: [...createdProfileIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });

    createdAttemptIds.clear();
    createdIdentityIds.clear();
    createdProfileIds.clear();
    createdUserIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows only one active attempt per professional profile", async () => {
    const fixture = await createFixture();
    await createAttempt(fixture);

    await expect(createAttempt(fixture)).rejects.toMatchObject({ code: "P2002" });

    // The failed statement was autocommitted independently, so this connection
    // remains usable for the next verification.
    await expect(
      prisma.professionalIdentityVerificationAttempt.count({
        where: { professionalProfileId: fixture.professionalProfileId },
      }),
    ).resolves.toBe(1);
  });

  it("allows a new active attempt after closing or cancelling the previous one", async () => {
    const fixture = await createFixture();
    const closed = await createAttempt(fixture, {
      status: ProfessionalIdentityVerificationAttemptStatus.CLOSED,
      result: IdentityVerificationResult.CONFIRMED,
      closedAt: new Date(),
    });
    const activeAfterClose = await createAttempt(fixture);

    await prisma.professionalIdentityVerificationAttempt.update({
      where: { id: activeAfterClose.id },
      data: {
        status: ProfessionalIdentityVerificationAttemptStatus.CANCELLED,
        result: IdentityVerificationResult.PENDING,
        closedAt: new Date(),
      },
    });
    const activeAfterCancellation = await createAttempt(fixture);

    expect([closed.id, activeAfterClose.id, activeAfterCancellation.id]).toHaveLength(3);
  });

  it.each([
    {
      name: "an active status with a final result",
      data: {
        status: ProfessionalIdentityVerificationAttemptStatus.AWAITING_EVIDENCE,
        result: IdentityVerificationResult.CONFIRMED,
        closedAt: null,
      },
    },
    {
      name: "a closed status with PENDING result",
      data: {
        status: ProfessionalIdentityVerificationAttemptStatus.CLOSED,
        result: IdentityVerificationResult.PENDING,
        closedAt: new Date(),
      },
    },
    {
      name: "a cancelled status with a final result",
      data: {
        status: ProfessionalIdentityVerificationAttemptStatus.CANCELLED,
        result: IdentityVerificationResult.NOT_CONFIRMED,
        closedAt: new Date(),
      },
    },
    {
      name: "a closed status without closedAt",
      data: {
        status: ProfessionalIdentityVerificationAttemptStatus.CLOSED,
        result: IdentityVerificationResult.INCONCLUSIVE,
        closedAt: null,
      },
    },
  ])("rejects $name", async ({ data }) => {
    const fixture = await createFixture();

    await expect(createAttempt(fixture, data)).rejects.toBeDefined();
    await expect(createAttempt(fixture)).resolves.toMatchObject({
      status: ProfessionalIdentityVerificationAttemptStatus.AWAITING_EVIDENCE,
      result: IdentityVerificationResult.PENDING,
      closedAt: null,
    });
  });

  it("rejects a MANUAL decision without an operator and a PENDING decision", async () => {
    const fixture = await createFixture({ operator: true });
    const attempt = await createAttempt(fixture);

    await expect(
      prisma.identityVerificationDecision.create({
        data: {
          id: randomUUID(),
          attemptId: attempt.id,
          source: IdentityVerificationDecisionSource.MANUAL,
          result: IdentityVerificationResult.CONFIRMED,
          reasonCode: "integration-only",
          criteriaVersion: "v1",
        },
      }),
    ).rejects.toBeDefined();

    await expect(
      prisma.identityVerificationDecision.create({
        data: {
          id: randomUUID(),
          attemptId: attempt.id,
          source: IdentityVerificationDecisionSource.MANUAL,
          result: IdentityVerificationResult.PENDING,
          reasonCode: "integration-only",
          criteriaVersion: "v1",
          operatorUserId: fixture.operatorUserId,
        },
      }),
    ).rejects.toBeDefined();

    await expect(
      prisma.identityVerificationDecision.create({
        data: {
          id: randomUUID(),
          attemptId: attempt.id,
          source: IdentityVerificationDecisionSource.MANUAL,
          result: IdentityVerificationResult.CONFIRMED,
          reasonCode: "integration-only",
          criteriaVersion: "v1",
          operatorUserId: fixture.operatorUserId,
        },
      }),
    ).resolves.toMatchObject({ result: IdentityVerificationResult.CONFIRMED });
  });

  it("uses RESTRICT for every referenced verification record", async () => {
    const fixture = await createFixture({ operator: true });
    const attempt = await createAttempt(fixture);
    await prisma.identityVerificationDecision.create({
      data: {
        id: randomUUID(),
        attemptId: attempt.id,
        source: IdentityVerificationDecisionSource.MANUAL,
        result: IdentityVerificationResult.CONFIRMED,
        reasonCode: "integration-only",
        criteriaVersion: "v1",
        operatorUserId: fixture.operatorUserId,
      },
    });
    await prisma.identityVerificationEvidenceReference.create({
      data: { id: randomUUID(), attemptId: attempt.id, kind: "DOCUMENT", reference: "integration-only" },
    });

    await expect(prisma.professionalProfile.delete({ where: { id: fixture.professionalProfileId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.personalIdentity.delete({ where: { id: fixture.personalIdentityId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.user.delete({ where: { id: fixture.operatorUserId! } })).rejects.toMatchObject({ code: "P2003" });
    await expect(prisma.professionalIdentityVerificationAttempt.delete({ where: { id: attempt.id } })).rejects.toMatchObject({ code: "P2003" });
  });

  async function createFixture(options: { operator?: boolean } = {}) {
    const userId = await createUser("professional");
    const professionalProfileId = randomUUID();
    const personalIdentityId = randomUUID();
    createdProfileIds.add(professionalProfileId);
    createdIdentityIds.add(personalIdentityId);
    await prisma.professionalProfile.create({
      data: { id: professionalProfileId, userId, displayName: "Integration professional" },
    });
    await prisma.personalIdentity.create({
      data: {
        id: personalIdentityId,
        userId,
        cpfEnvelope: { value: "integration-only" },
        cpfHmac: randomUUID().replaceAll("-", ""),
        hmacKeyId: "integration-only",
      },
    });
    const operatorUserId = options.operator ? await createUser("operator") : undefined;
    return { professionalProfileId, personalIdentityId, operatorUserId };
  }

  async function createUser(kind: string): Promise<string> {
    const id = randomUUID();
    const email = `${kind}-${randomUUID()}@example.test`;
    createdUserIds.add(id);
    await prisma.user.create({
      data: {
        id,
        name: `Integration ${kind}`,
        email,
        emailNormalized: email,
        passwordHash: "integration-only",
        status: UserStatus.ACTIVE,
      },
    });
    return id;
  }

  async function createAttempt(
    fixture: Awaited<ReturnType<typeof createFixture>>,
    data: Partial<{
      status: ProfessionalIdentityVerificationAttemptStatus;
      result: IdentityVerificationResult;
      closedAt: Date | null;
    }> = {},
  ) {
    const id = randomUUID();
    const attempt = await prisma.professionalIdentityVerificationAttempt.create({
      data: {
        id,
        professionalProfileId: fixture.professionalProfileId,
        personalIdentityId: fixture.personalIdentityId,
        ...data,
      },
    });
    createdAttemptIds.add(id);
    return attempt;
  }
});
