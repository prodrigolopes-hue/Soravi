import { randomUUID } from "node:crypto";

import { createCpfProtector } from "../common/cpf/cpf-protection";
import { PrismaService } from "../database/prisma.service";
import { Prisma, UserStatus } from "../generated/prisma/client";
import { PersonalIdentityCpfUnavailableException } from "../modules/users/errors/personal-identity-cpf-unavailable.exception";
import { PersonalIdentityRecordingService } from "../modules/users/personal-identity-recording.service";
import { deferred, queryRawSql, waitUntilPostgresConfirmsBlocking, wrapPrisma } from "./integration-concurrency";
import { createIntegrationPrismaService } from "./integration-database";

describe("Personal identity recording concurrency", () => {
  const controlPrisma = createIntegrationPrismaService();
  const firstPrisma = createIntegrationPrismaService();
  const secondPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const pendingOperations = new Set<Promise<unknown>>();
  const cpf = "529.982.247-25";

  beforeAll(async () => { await Promise.all([controlPrisma.$connect(), firstPrisma.$connect(), secondPrisma.$connect()]); });
  afterEach(async () => {
    await Promise.allSettled([...pendingOperations]);
    for (const userId of createdUserIds) {
      await controlPrisma.personalIdentity.deleteMany({ where: { userId } });
      await controlPrisma.user.deleteMany({ where: { id: userId } });
      createdUserIds.delete(userId);
    }
  });
  afterAll(async () => { await Promise.all([controlPrisma.$disconnect(), firstPrisma.$disconnect(), secondPrisma.$disconnect()]); });

  it("serializes simultaneous initial recordings for the same account", async () => {
    const userId = await createUser();
    const firstUserLocked = deferred<void>();
    const releaseFirst = deferred<void>();
    const secondUserLocked = deferred<void>();
    const releaseSecond = deferred<void>();
    const blockedPid = deferred<number>();
    const first = service(wrapPrisma(firstPrisma, { afterQueryRaw: async (args) => {
      if (queryRawSql(args).includes('FROM "users"')) { firstUserLocked.resolve(); await releaseFirst.promise; }
    } }));
    const second = service(wrapPrisma(secondPrisma, {
      transactionStarted: (pid) => blockedPid.resolve(pid),
      afterQueryRaw: async (args) => {
        if (queryRawSql(args).includes('FROM "users"')) { secondUserLocked.resolve(); await releaseSecond.promise; }
      },
    }));
    let firstOperation: Promise<unknown> | undefined;
    let secondOperation: Promise<unknown> | undefined;

    try {
      firstOperation = track(first.recordInitial(userId, cpf));
      await firstUserLocked.promise;
      secondOperation = track(second.recordInitial(userId, cpf));
      await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise);

      releaseFirst.resolve();
      await expect(firstOperation).resolves.toEqual({ recorded: true });
      await secondUserLocked.promise;
      const originalIdentity = await controlPrisma.personalIdentity.findUniqueOrThrow({ where: { userId }, select: { cpfEnvelope: true } });

      releaseSecond.resolve();
      await expect(secondOperation).resolves.toEqual({ recorded: true });
      const finalIdentity = await controlPrisma.personalIdentity.findUniqueOrThrow({ where: { userId }, select: { cpfEnvelope: true } });
      expect(finalIdentity.cpfEnvelope).toEqual(originalIdentity.cpfEnvelope);
      await expect(controlPrisma.personalIdentity.count({ where: { userId } })).resolves.toBe(1);
    } finally {
      releaseFirst.resolve();
      releaseSecond.resolve();
      await settle(firstOperation, secondOperation);
    }
  });

  it("allows exactly one account to claim a CPF after both availability checks", async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const firstCpfAvailable = deferred<void>();
    const secondCpfAvailable = deferred<void>();
    const releaseCreates = deferred<void>();
    const first = service(gateCpfAvailabilityLookup(firstPrisma, async () => {
      firstCpfAvailable.resolve();
      await releaseCreates.promise;
    }));
    const second = service(gateCpfAvailabilityLookup(secondPrisma, async () => {
      secondCpfAvailable.resolve();
      await releaseCreates.promise;
    }));
    let firstOperation: Promise<unknown> | undefined;
    let secondOperation: Promise<unknown> | undefined;

    try {
      firstOperation = track(first.recordInitial(firstUserId, cpf));
      secondOperation = track(second.recordInitial(secondUserId, cpf));
      await Promise.all([firstCpfAvailable.promise, secondCpfAvailable.promise]);

      releaseCreates.resolve();
      const results = await Promise.allSettled([firstOperation, secondOperation]);
      const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
      const rejected = results.find((result) => result.status === "rejected");
      expect(winnerIndex).not.toBe(-1);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(rejected).toMatchObject({ status: "rejected", reason: expect.any(PersonalIdentityCpfUnavailableException) });

      const winnerUserId = [firstUserId, secondUserId][winnerIndex];
      const loserUserId = winnerUserId === firstUserId ? secondUserId : firstUserId;
      await expect(controlPrisma.personalIdentity.count({ where: { userId: winnerUserId } })).resolves.toBe(1);
      await expect(controlPrisma.personalIdentity.count({ where: { userId: loserUserId } })).resolves.toBe(0);
    } finally {
      releaseCreates.resolve();
      await settle(firstOperation, secondOperation);
    }
  });

  async function createUser(): Promise<string> {
    const id = randomUUID();
    const email = `personal-identity-${randomUUID()}@example.test`;
    createdUserIds.add(id);
    await controlPrisma.user.create({ data: { id, name: "Integration identity", email, emailNormalized: email, passwordHash: "integration-only", status: UserStatus.ACTIVE } });
    return id;
  }

  function service(prisma: PrismaService): PersonalIdentityRecordingService {
    return new PersonalIdentityRecordingService(prisma, protector(), "test-hmac-v1");
  }

  function track<T>(operation: Promise<T>): Promise<T> {
    pendingOperations.add(operation);
    operation.then(() => pendingOperations.delete(operation), () => pendingOperations.delete(operation));
    return operation;
  }
});

function gateCpfAvailabilityLookup(
  prisma: PrismaService,
  afterLookup: () => Promise<void>,
): PrismaService {
  return new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== "$transaction") {
        const original = Reflect.get(target, property, receiver);
        return typeof original === "function" ? original.bind(target) : original;
      }
      return async (
        callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
      ) => target.$transaction(
        async (transaction) => callback(gateTransactionCpfLookup(transaction, afterLookup)),
        options,
      );
    },
  }) as PrismaService;
}

function gateTransactionCpfLookup(
  transaction: Prisma.TransactionClient,
  afterLookup: () => Promise<void>,
): Prisma.TransactionClient {
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property !== "personalIdentity") {
        const original = Reflect.get(target, property, receiver);
        return typeof original === "function" ? original.bind(target) : original;
      }
      return new Proxy(target.personalIdentity, {
        get(delegate, delegateProperty, delegateReceiver) {
          const original = Reflect.get(delegate, delegateProperty, delegateReceiver);
          if (delegateProperty !== "findFirst" || typeof original !== "function") return typeof original === "function" ? original.bind(delegate) : original;
          return async (...args: unknown[]) => {
            const result = await Reflect.apply(original, delegate, args);
            await afterLookup();
            return result;
          };
        },
      });
    },
  }) as Prisma.TransactionClient;
}

async function settle(...operations: Array<Promise<unknown> | undefined>): Promise<void> {
  await Promise.allSettled(operations.filter((operation): operation is Promise<unknown> => operation !== undefined));
}

function protector() {
  return createCpfProtector({ encryptionKey: Buffer.alloc(32, 3), hmacKey: Buffer.alloc(32, 4), encryptionKeyId: "test-encryption-v1" });
}
