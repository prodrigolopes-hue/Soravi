import { createHash, randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../database/prisma.service";
import { Prisma, Role, UserStatus } from "../generated/prisma/client";
import {
  EmailVerificationDeliveryPort,
} from "../modules/auth/email-verification-delivery.port";
import { EmailVerificationService } from "../modules/auth/email-verification.service";
import { PhoneVerificationCodeService } from "../modules/phone-verification/phone-verification-code.service";
import { PhoneVerificationDeliveryPort } from "../modules/phone-verification/phone-verification-delivery.port";
import { PhoneVerificationService } from "../modules/phone-verification/phone-verification.service";
import {
  deferred,
  queryRawSql,
  waitUntilPostgresConfirmsBlocking,
  wrapPrisma,
} from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

const emailDeliveryNoOp: EmailVerificationDeliveryPort = {
  async sendVerification(): Promise<void> {},
};
const phoneDeliveryNoOp: PhoneVerificationDeliveryPort = {
  async sendOtp(): Promise<void> {},
};

describe("Ativação automática de cliente com confirmações concorrentes", () => {
  const controlPrisma = createIntegrationPrismaService();
  const emailPrisma = createIntegrationPrismaService();
  const phonePrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    await Promise.all([
      controlPrisma.$connect(),
      emailPrisma.$connect(),
      phonePrisma.$connect(),
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
      emailPrisma.$disconnect(),
      phonePrisma.$disconnect(),
    ]);
  });

  it("ativa uma única vez após confirmações simultâneas e persiste o estado final", async () => {
    const fixture = await createFixture();
    const emailUserLockAcquired = deferred<void>();
    const releaseEmail = deferred<void>();
    const phoneUserLockAttempted = deferred<void>();
    const phoneBackendPid = deferred<number>();
    const emailService = new EmailVerificationService(
      wrapPrisma(emailPrisma, {
        afterQueryRaw: async (args) => {
          if (queryRawSql(args).includes('FROM "users"')) {
            emailUserLockAcquired.resolve();
            await releaseEmail.promise;
          }
        },
      }),
      emailDeliveryNoOp,
    );
    const phoneService = createPhoneVerificationService(
      wrapPrisma(phonePrisma, {
        transactionStarted: (pid) => phoneBackendPid.resolve(pid),
        beforeQueryRaw: (args) => {
          if (queryRawSql(args).includes('FROM "users"')) {
            phoneUserLockAttempted.resolve();
          }
        },
      }),
    );

    const emailConfirmation = emailService.confirm(fixture.rawEmailToken);
    await emailUserLockAcquired.promise;
    const phoneConfirmation = phoneService.confirmCode(
      fixture.userId,
      fixture.phoneCode,
    );
    await phoneUserLockAttempted.promise;
    await waitUntilPostgresConfirmsBlocking(
      controlPrisma,
      await phoneBackendPid.promise,
    );
    releaseEmail.resolve();

    await expect(emailConfirmation).resolves.toEqual({
      userId: fixture.userId,
      activatedCustomerAccount: false,
    });
    await expect(phoneConfirmation).resolves.toEqual({
      activatedCustomerAccount: true,
    });

    const user = await controlPrisma.user.findUniqueOrThrow({
      where: { id: fixture.userId },
      select: {
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        customerProfile: { select: { id: true } },
        roles: { select: { role: true } },
      },
    });
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.customerProfile).not.toBeNull();
    expect(user.roles.map(({ role }) => role)).toContain(Role.CUSTOMER);
  });

  async function createFixture(): Promise<{
    userId: string;
    rawEmailToken: string;
    phoneCode: string;
  }> {
    const userId = randomUUID();
    const email = `customer-auto-activation-${randomUUID()}@example.test`;
    const rawEmailToken = randomUUID().replaceAll("-", "");
    const phoneCode = "012345";
    const phoneNormalized = "+5521999999999";
    const challengeId = randomUUID();
    const codeService = createPhoneCodeService();

    createdUserIds.add(userId);
    await controlPrisma.user.create({
      data: {
        id: userId,
        name: "Cliente de integração",
        email,
        emailNormalized: email,
        passwordHash: "integration-only",
        phone: "+55 21 99999-9999",
        phoneNormalized,
        status: UserStatus.PENDING,
        roles: { create: { role: Role.CUSTOMER } },
        customerProfile: { create: {} },
        emailVerificationTokens: {
          create: {
            id: randomUUID(),
            tokenHash: createHash("sha256").update(rawEmailToken, "utf8").digest("hex"),
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
        phoneVerificationChallenges: {
          create: {
            id: challengeId,
            phoneNormalized,
            codeHash: codeService.hashCode({
              challengeId,
              userId,
              phoneNormalized,
              code: phoneCode,
            }),
            expiresAt: new Date(Date.now() + 60_000),
            maxAttempts: 5,
          },
        },
      },
    });

    return { userId, rawEmailToken, phoneCode };
  }

  function createPhoneCodeService(): PhoneVerificationCodeService {
    return new PhoneVerificationCodeService(createConfig());
  }

  function createPhoneVerificationService(
    prisma: PrismaService,
  ): PhoneVerificationService {
    return new PhoneVerificationService(
      prisma,
      createPhoneCodeService(),
      phoneDeliveryNoOp,
      createConfig(),
    );
  }

  function createConfig(): ConfigService {
    return new ConfigService({
      PHONE_VERIFICATION_HMAC_SECRET:
        "integration-phone-verification-secret-that-never-leaves-memory",
      PHONE_VERIFICATION_TTL_SECONDS: 600,
      PHONE_VERIFICATION_MAX_ATTEMPTS: 5,
      PHONE_VERIFICATION_COOLDOWN_SECONDS: 60,
    });
  }
});
