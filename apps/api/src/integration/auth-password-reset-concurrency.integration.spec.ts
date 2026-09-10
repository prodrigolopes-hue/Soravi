import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { argon2id, hash, verify } from "argon2";

import { PrismaService } from "../database/prisma.service";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { AuthService } from "../modules/auth/auth.service";
import { AuthTokensService } from "../modules/auth/auth-tokens.service";
import { InvalidCredentialsException } from "../modules/auth/errors/invalid-credentials.exception";
import { PasswordResetDeliveryPort } from "../modules/auth/password-reset-delivery.port";
import { PasswordResetService } from "../modules/auth/password-reset.service";
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
  rawToken: string;
  tokenId: string;
}

const deliveryPortNoOp: PasswordResetDeliveryPort = {
  async sendReset(): Promise<void> {},
};

describe("AuthService e confirmação de password reset concorrentes", () => {
  const controlPrisma = createIntegrationPrismaService();
  const loginPrisma = createIntegrationPrismaService();
  const resetPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const oldPassword = "Old-integration-password-42!";
  const newPassword = "New-integration-password-84!";

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
    const email = `integration-reset-${randomUUID()}@example.test`;
    const oldPasswordHash = await hash(oldPassword, { type: argon2id });
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
    const tokenId = randomUUID();

    await controlPrisma.user.create({
      data: {
        id: userId,
        name: "Password Reset Integration User",
        email,
        emailNormalized: email,
        passwordHash: oldPasswordHash,
        status: UserStatus.ACTIVE,
        roles: { create: { role: Role.CUSTOMER } },
        customerProfile: { create: {} },
        passwordResetTokens: {
          create: {
            id: tokenId,
            tokenHash,
            expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
            usedAt: null,
          },
        },
      },
    });
    createdUserIds.add(userId);
    return { userId, email, oldPasswordHash, rawToken, tokenId };
  }

  async function expectResetState(
    fixture: Fixture,
    expectedSessionCount: number,
  ): Promise<void> {
    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
      select: {
        status: true,
        passwordHash: true,
        lastLoginAt: true,
        sessions: true,
        passwordResetTokens: {
          where: { id: fixture.tokenId },
          select: { usedAt: true },
        },
      },
    });
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(await verify(user.passwordHash, newPassword)).toBe(true);
    expect(await verify(user.passwordHash, oldPassword)).toBe(false);
    expect(user.passwordResetTokens).toHaveLength(1);
    expect(user.passwordResetTokens[0]?.usedAt).not.toBeNull();
    expect(user.sessions).toHaveLength(expectedSessionCount);
    if (expectedSessionCount === 1) {
      expect(user.sessions[0]?.revokedAt).not.toBeNull();
    } else {
      expect(user.lastLoginAt).toBeNull();
    }
  }

  beforeAll(async () => {
    await Promise.all([
      controlPrisma.$connect(),
      loginPrisma.$connect(),
      resetPrisma.$connect(),
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
      resetPrisma.$disconnect(),
    ]);
  });

  it("revoga a sessão criada quando o login ganha o lock", async () => {
    const fixture = await createFixture();
    const loginLockAcquired = deferred<void>();
    const releaseLogin = deferred<void>();
    const resetUserLockAttempted = deferred<void>();
    const resetBackendPid = deferred<number>();
    const authService = createAuthService(wrapPrisma(loginPrisma, {
      afterUserUpdate: async () => {
        loginLockAcquired.resolve();
        await releaseLogin.promise;
      },
    }));
    const resetService = new PasswordResetService(wrapPrisma(resetPrisma, {
      transactionStarted: (pid) => resetBackendPid.resolve(pid),
      beforeQueryRaw: (args) => {
        if (queryRawSql(args).includes('FROM "users"')) {
          resetUserLockAttempted.resolve();
        }
      },
    }), deliveryPortNoOp);

    const login = authService.loginWithSession({
      email: fixture.email,
      password: oldPassword,
    });
    await loginLockAcquired.promise;
    const reset = resetService.confirmReset(fixture.rawToken, newPassword);
    await resetUserLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await resetBackendPid.promise,
    );
    releaseLogin.resolve();

    await expect(login).resolves.toBeDefined();
    await expect(reset).resolves.toBeUndefined();
    await expectResetState(fixture, 1);
  });

  it("reverte o login com senha antiga quando o reset ganha o lock", async () => {
    const fixture = await createFixture();
    const resetUserLockAcquired = deferred<void>();
    const releaseReset = deferred<void>();
    const loginPreReadCompleted = deferred<void>();
    const loginLockAttempted = deferred<void>();
    const loginBackendPid = deferred<number>();
    const resetService = new PasswordResetService(wrapPrisma(resetPrisma, {
      afterQueryRaw: async (args) => {
        if (queryRawSql(args).includes('FROM "users"')) {
          resetUserLockAcquired.resolve();
          await releaseReset.promise;
        }
      },
    }), deliveryPortNoOp);
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

    const reset = resetService.confirmReset(fixture.rawToken, newPassword);
    await resetUserLockAcquired.promise;
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
    releaseReset.resolve();

    await expect(reset).resolves.toBeUndefined();
    await expect(login).rejects.toBeInstanceOf(InvalidCredentialsException);
    await expectResetState(fixture, 0);
  });
});
