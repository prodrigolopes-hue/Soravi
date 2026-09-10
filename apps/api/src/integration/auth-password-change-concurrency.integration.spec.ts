import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { argon2id, hash, verify } from "argon2";

import { PrismaService } from "../database/prisma.service";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { AuthService } from "../modules/auth/auth.service";
import { AuthTokensService } from "../modules/auth/auth-tokens.service";
import { InvalidCredentialsException } from "../modules/auth/errors/invalid-credentials.exception";
import { UsersPasswordService } from "../modules/users/users-password.service";
import { UsersService } from "../modules/users/users.service";
import {
  deferred,
  queryRawSql,
  waitUntilPostgresConfirmsBlocking,
  wrapPrisma,
} from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

interface Fixture {
  userId: string;
  email: string;
  oldPasswordHash: string;
  currentSessionId: string;
}

describe("AuthService e troca autenticada de senha concorrentes", () => {
  const controlPrisma = createIntegrationPrismaService();
  const loginPrisma = createIntegrationPrismaService();
  const passwordChangePrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const oldPassword = "Old-password-change-integration-42!";
  const newPassword = "New-password-change-integration-84!";

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

  async function createFixture(): Promise<Fixture> {
    const userId = randomUUID();
    const email = `integration-password-change-${randomUUID()}@example.test`;
    const oldPasswordHash = await hash(oldPassword, { type: argon2id });
    const currentSessionId = randomUUID();

    await controlPrisma.user.create({
      data: {
        id: userId,
        name: "Password Change Integration User",
        email,
        emailNormalized: email,
        passwordHash: oldPasswordHash,
        status: UserStatus.ACTIVE,
        lastLoginAt: null,
        roles: { create: { role: Role.CUSTOMER } },
        customerProfile: { create: {} },
        sessions: {
          create: {
            id: currentSessionId,
            refreshTokenHash: `integration-password-change-${randomUUID()}`,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
            revokedAt: null,
          },
        },
      },
    });
    createdUserIds.add(userId);
    return { userId, email, oldPasswordHash, currentSessionId };
  }

  async function readFinalState(fixture: Fixture) {
    return controlPrisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
      select: {
        status: true,
        passwordHash: true,
        lastLoginAt: true,
        sessions: true,
      },
    });
  }

  beforeAll(async () => {
    await Promise.all([
      controlPrisma.$connect(),
      loginPrisma.$connect(),
      passwordChangePrisma.$connect(),
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
      loginPrisma.$disconnect(),
      passwordChangePrisma.$disconnect(),
    ]);
  });

  it("revoga a nova sessão quando o login ganha o lock", async () => {
    const fixture = await createFixture();
    const loginLockAcquired = deferred<void>();
    const releaseLogin = deferred<void>();
    const passwordChangeUserLockAttempted = deferred<void>();
    const passwordChangeBackendPid = deferred<number>();
    const authService = createAuthService(wrapPrisma(loginPrisma, {
      afterUserUpdate: async () => {
        loginLockAcquired.resolve();
        await releaseLogin.promise;
      },
    }));
    const usersPasswordService = new UsersPasswordService(
      wrapPrisma(passwordChangePrisma, {
        transactionStarted: (pid) => passwordChangeBackendPid.resolve(pid),
        beforeQueryRaw: (args) => {
          if (queryRawSql(args).includes('FROM "users"')) {
            passwordChangeUserLockAttempted.resolve();
          }
        },
      }),
    );

    const login = authService.loginWithSession({
      email: fixture.email,
      password: oldPassword,
    });
    await loginLockAcquired.promise;
    const passwordChange = usersPasswordService.updateCurrentUserPassword(
      fixture.userId,
      fixture.currentSessionId,
      { currentPassword: oldPassword, newPassword },
    );
    await passwordChangeUserLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await passwordChangeBackendPid.promise,
    );
    releaseLogin.resolve();

    await expect(login).resolves.toBeDefined();
    await expect(passwordChange).resolves.toBeUndefined();
    const user = await readFinalState(fixture);
    const currentSession = user.sessions.find(
      ({ id }) => id === fixture.currentSessionId,
    );
    const newSessions = user.sessions.filter(
      ({ id }) => id !== fixture.currentSessionId,
    );
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(await verify(user.passwordHash, newPassword)).toBe(true);
    expect(await verify(user.passwordHash, oldPassword)).toBe(false);
    expect(user.lastLoginAt).not.toBeNull();
    expect(user.sessions).toHaveLength(2);
    expect(currentSession?.revokedAt).toBeNull();
    expect(newSessions).toHaveLength(1);
    expect(newSessions[0]?.revokedAt).not.toBeNull();
  });

  it("reverte o login com senha antiga quando a troca ganha o lock", async () => {
    const fixture = await createFixture();
    const passwordChangeUserLockAcquired = deferred<void>();
    const releasePasswordChange = deferred<void>();
    const loginPreReadCompleted = deferred<void>();
    const loginLockAttempted = deferred<void>();
    const loginBackendPid = deferred<number>();
    const usersPasswordService = new UsersPasswordService(
      wrapPrisma(passwordChangePrisma, {
        afterQueryRaw: async (args) => {
          if (queryRawSql(args).includes('FROM "users"')) {
            passwordChangeUserLockAcquired.resolve();
            await releasePasswordChange.promise;
          }
        },
      }),
    );
    const authService = createAuthService(wrapPrisma(loginPrisma, {
      transactionStarted: (pid) => loginBackendPid.resolve(pid),
      afterUserFindFirst: (result) => {
        if (
          typeof result === "object" &&
          result !== null &&
          "status" in result &&
          result.status === UserStatus.ACTIVE &&
          "passwordHash" in result &&
          result.passwordHash === fixture.oldPasswordHash
        ) {
          loginPreReadCompleted.resolve();
        }
      },
      beforeUserUpdate: () => loginLockAttempted.resolve(),
    }));

    const passwordChange = usersPasswordService.updateCurrentUserPassword(
      fixture.userId,
      fixture.currentSessionId,
      { currentPassword: oldPassword, newPassword },
    );
    await passwordChangeUserLockAcquired.promise;
    const login = authService.loginWithSession({
      email: fixture.email,
      password: oldPassword,
    });
    await loginPreReadCompleted.promise;
    await loginLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await loginBackendPid.promise,
    );
    releasePasswordChange.resolve();

    await expect(passwordChange).resolves.toBeUndefined();
    await expect(login).rejects.toBeInstanceOf(InvalidCredentialsException);
    const user = await readFinalState(fixture);
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(await verify(user.passwordHash, newPassword)).toBe(true);
    expect(await verify(user.passwordHash, oldPassword)).toBe(false);
    expect(user.lastLoginAt).toBeNull();
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0]?.id).toBe(fixture.currentSessionId);
    expect(user.sessions[0]?.revokedAt).toBeNull();
  });
});
