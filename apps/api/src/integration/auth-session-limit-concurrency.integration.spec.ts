import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { argon2id, hash } from "argon2";

import { PrismaService } from "../database/prisma.service";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { AuthService } from "../modules/auth/auth.service";
import { getAuthSessionAbsoluteExpiresAt } from "../modules/auth/auth-session-lifetime";
import { AuthTokensService } from "../modules/auth/auth-tokens.service";
import { UsersService } from "../modules/users/users.service";
import {
  deferred,
  waitUntilPostgresConfirmsBlocking,
  wrapPrisma,
} from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

const SEEDED_SESSION_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
] as const;

describe("limite de sessões sob logins concorrentes", () => {
  const controlPrisma = createIntegrationPrismaService();
  const loginAPrisma = createIntegrationPrismaService();
  const loginBPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const password = "Session-limit-integration-password-42!";

  function createAuthService(prisma: PrismaService): AuthService {
    const config = new ConfigService({
      JWT_ACCESS_SECRET: "integration-test-secret-that-never-leaves-memory",
      JWT_ACCESS_EXPIRES_IN_SECONDS: 900,
      JWT_REFRESH_EXPIRES_IN_DAYS: 30,
    });
    return new AuthService(
      prisma,
      new UsersService(prisma),
      new AuthTokensService(new JwtService(), config),
    );
  }

  async function createFixture(): Promise<{ userId: string; email: string }> {
    const userId = randomUUID();
    const email = `integration-session-limit-${randomUUID()}@example.test`;
    const now = Date.now();
    const oldestCreatedAt = new Date(now - 5 * 24 * 60 * 60 * 1_000);
    const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1_000);

    await controlPrisma.user.create({
      data: {
        id: userId,
        name: "Session Limit Integration User",
        email,
        emailNormalized: email,
        passwordHash: await hash(password, { type: argon2id }),
        status: UserStatus.ACTIVE,
        roles: { create: { role: Role.CUSTOMER } },
        customerProfile: { create: {} },
        sessions: {
          create: SEEDED_SESSION_IDS.map((id, index) => ({
            id,
            refreshTokenHash: `integration-session-limit-${userId}-${index}`,
            createdAt:
              index < 3
                ? oldestCreatedAt
                : new Date(now - (6 - index) * 24 * 60 * 60 * 1_000),
            expiresAt,
            revokedAt: null,
          })),
        },
      },
    });
    createdUserIds.add(userId);
    return { userId, email };
  }

  beforeAll(async () => {
    await Promise.all([
      controlPrisma.$connect(),
      loginAPrisma.$connect(),
      loginBPrisma.$connect(),
    ]);
    const [database] = await controlPrisma.$queryRaw<
      Array<{ current_database: string }>
    >(Prisma.sql`SELECT current_database()`);
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("A suíte recusou executar fora do banco de integração.");
    }
  });

  afterEach(async () => {
    for (const userId of createdUserIds) {
      await controlPrisma.user.delete({ where: { id: userId } });
      createdUserIds.delete(userId);
    }
  });

  afterAll(async () => {
    await Promise.all([
      controlPrisma.$disconnect(),
      loginAPrisma.$disconnect(),
      loginBPrisma.$disconnect(),
    ]);
  });

  it("mantém cinco sessões ativas após dois logins concorrentes", async () => {
    const fixture = await createFixture();
    const loginALockAcquired = deferred<void>();
    const releaseLoginA = deferred<void>();
    const loginBLockAttempted = deferred<void>();
    const loginBBackendPid = deferred<number>();
    const authServiceA = createAuthService(wrapPrisma(loginAPrisma, {
      afterUserUpdate: async () => {
        loginALockAcquired.resolve();
        await releaseLoginA.promise;
      },
    }));
    const authServiceB = createAuthService(wrapPrisma(loginBPrisma, {
      transactionStarted: (pid) => loginBBackendPid.resolve(pid),
      beforeUserUpdate: () => loginBLockAttempted.resolve(),
    }));

    const loginA = authServiceA.loginWithSession({
      email: fixture.email,
      password,
    });
    await loginALockAcquired.promise;
    const loginB = authServiceB.loginWithSession({
      email: fixture.email,
      password,
    });
    await loginBLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await loginBBackendPid.promise,
    );
    releaseLoginA.resolve();

    await expect(loginA).resolves.toBeDefined();
    await expect(loginB).resolves.toBeDefined();

    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
      select: { status: true, sessions: true },
    });
    const assertionTime = new Date();
    const activeSessions = user.sessions.filter((session) =>
      session.revokedAt === null &&
      session.expiresAt > assertionTime &&
      getAuthSessionAbsoluteExpiresAt(session.createdAt) > assertionTime,
    );
    const revokedSessions = user.sessions.filter(
      (session) => session.revokedAt !== null,
    );
    const seededIds = new Set<string>(SEEDED_SESSION_IDS);
    const newSessions = user.sessions.filter(
      (session) => !seededIds.has(session.id),
    );
    const sessionsById = new Map(
      user.sessions.map((session) => [session.id, session]),
    );

    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.sessions).toHaveLength(7);
    expect(activeSessions).toHaveLength(5);
    expect(revokedSessions).toHaveLength(2);
    expect(revokedSessions.map(({ id }) => id).sort()).toEqual(
      [SEEDED_SESSION_IDS[0], SEEDED_SESSION_IDS[1]],
    );
    expect(sessionsById.get(SEEDED_SESSION_IDS[0])?.revokedAt).not.toBeNull();
    expect(sessionsById.get(SEEDED_SESSION_IDS[1])?.revokedAt).not.toBeNull();
    for (const id of SEEDED_SESSION_IDS.slice(2)) {
      expect(sessionsById.get(id)?.revokedAt).toBeNull();
    }
    expect(newSessions).toHaveLength(2);
    for (const session of newSessions) {
      expect(session.revokedAt).toBeNull();
      expect(session.expiresAt > assertionTime).toBe(true);
    }
  });
});
