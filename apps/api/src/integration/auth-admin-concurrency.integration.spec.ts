import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { argon2id, hash } from "argon2";

import { PrismaService } from "../database/prisma.service";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import { AuthService } from "../modules/auth/auth.service";
import { AuthTokensService } from "../modules/auth/auth-tokens.service";
import { AccountUnavailableException } from "../modules/auth/errors/account-unavailable.exception";
import { UsersAdminStatusService } from "../modules/users/users-admin-status.service";
import { UsersService } from "../modules/users/users.service";
import {
  deferred,
  waitUntilPostgresConfirmsBlocking,
  wrapPrisma,
} from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

describe("AuthService e bloqueio administrativo concorrentes", () => {
  const controlPrisma = createIntegrationPrismaService();
  const loginPrisma = createIntegrationPrismaService();
  const adminPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const password = "Integration-only-password-42!";

  function createAuthService(prisma: PrismaService): AuthService {
    const config = new ConfigService({
      JWT_ACCESS_SECRET: "integration-test-secret-that-never-leaves-memory",
      JWT_ACCESS_EXPIRES_IN_SECONDS: 900,
      JWT_REFRESH_EXPIRES_IN_DAYS: 30,
    });
    return new AuthService(prisma, new UsersService(prisma),
      new AuthTokensService(new JwtService(), config));
  }

  async function createTargetUser(): Promise<{ id: string; email: string }> {
    const id = randomUUID();
    const email = `integration-${randomUUID()}@example.test`;
    await controlPrisma.user.create({
      data: {
        id, name: "Integration Test User", email, emailNormalized: email,
        passwordHash: await hash(password, { type: argon2id }),
        status: UserStatus.ACTIVE,
        roles: { create: { role: Role.CUSTOMER } },
        customerProfile: { create: {} },
      },
    });
    createdUserIds.add(id);
    return { id, email };
  }

  beforeAll(async () => {
    await Promise.all([
      controlPrisma.$connect(), loginPrisma.$connect(), adminPrisma.$connect(),
    ]);
    const [database] = await controlPrisma.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("A suíte recusou executar fora do banco de integração.");
    }
  });

  afterEach(async () => {
    for (const id of createdUserIds) {
      await controlPrisma.user.delete({ where: { id } });
      createdUserIds.delete(id);
    }
  });

  afterAll(async () => {
    await Promise.all([
      controlPrisma.$disconnect(), loginPrisma.$disconnect(), adminPrisma.$disconnect(),
    ]);
  });

  it("revoga a sessão recém-criada quando o login ganha o lock", async () => {
    const target = await createTargetUser();
    const loginLockAcquired = deferred<void>();
    const releaseLogin = deferred<void>();
    const blockLockAttempted = deferred<void>();
    const adminBackendPid = deferred<number>();
    const authService = createAuthService(wrapPrisma(loginPrisma, {
      afterUserUpdate: async () => {
        loginLockAcquired.resolve();
        await releaseLogin.promise;
      },
    }));
    const adminService = new UsersAdminStatusService(wrapPrisma(adminPrisma, {
      transactionStarted: (pid) => adminBackendPid.resolve(pid),
      beforeQueryRaw: () => blockLockAttempted.resolve(),
    }));

    const login = authService.loginWithSession({ email: target.email, password });
    await loginLockAcquired.promise;
    const block = adminService.updateStatus(randomUUID(), target.id, {
      status: UserStatus.BLOCKED,
    });
    await blockLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await adminBackendPid.promise,
    );
    releaseLogin.resolve();

    await expect(login).resolves.toBeDefined();
    await expect(block).resolves.toBeUndefined();
    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: target.id }, select: { status: true, sessions: true },
    });
    expect(user.status).toBe(UserStatus.BLOCKED);
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0]?.revokedAt).not.toBeNull();
  });

  it("impede sessão após pré-leitura obsoleta quando o bloqueio ganha o lock", async () => {
    const target = await createTargetUser();
    const blockLockAcquired = deferred<void>();
    const releaseBlock = deferred<void>();
    const loginPreReadCompleted = deferred<void>();
    const loginLockAttempted = deferred<void>();
    const loginBackendPid = deferred<number>();
    const adminService = new UsersAdminStatusService(wrapPrisma(adminPrisma, {
      afterQueryRaw: async () => {
        blockLockAcquired.resolve();
        await releaseBlock.promise;
      },
    }));
    const authService = createAuthService(wrapPrisma(loginPrisma, {
      transactionStarted: (pid) => loginBackendPid.resolve(pid),
      afterUserFindFirst: (result) => {
        if (typeof result === "object" && result !== null &&
          "status" in result && result.status === UserStatus.ACTIVE) {
          loginPreReadCompleted.resolve();
        }
      },
      beforeUserUpdate: () => loginLockAttempted.resolve(),
    }));

    const block = adminService.updateStatus(randomUUID(), target.id, {
      status: UserStatus.BLOCKED,
    });
    await blockLockAcquired.promise;
    const login = authService.loginWithSession({ email: target.email, password });
    await loginPreReadCompleted.promise;
    await loginLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await loginBackendPid.promise,
    );
    releaseBlock.resolve();

    await expect(block).resolves.toBeUndefined();
    await expect(login).rejects.toBeInstanceOf(AccountUnavailableException);
    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { status: true, lastLoginAt: true, sessions: true },
    });
    expect(user.status).toBe(UserStatus.BLOCKED);
    expect(user.lastLoginAt).toBeNull();
    expect(user.sessions).toHaveLength(0);
  });
});
