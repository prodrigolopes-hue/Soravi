import { randomUUID } from "node:crypto";
import { Client } from "pg";

import { createCpfProtector } from "../common/cpf/cpf-protection";
import { PrismaService } from "../database/prisma.service";
import {
  CpfHmacKeyBindingState,
  Prisma,
  UserStatus,
} from "../generated/prisma/client";
import { PersonalIdentityCpfUnavailableException } from "../modules/users/errors/personal-identity-cpf-unavailable.exception";
import { PersonalIdentityRecordingService } from "../modules/users/personal-identity-recording.service";
import { deferred, queryRawSql, waitUntilPostgresConfirmsBlocking, wrapPrisma } from "./integration-concurrency";
import {
  createIntegrationPrismaService,
  getIntegrationDatabaseUrl,
} from "./integration-database";

describe("Personal identity recording concurrency", () => {
  const controlPrisma = createIntegrationPrismaService();
  const firstPrisma = createIntegrationPrismaService();
  const secondPrisma = createIntegrationPrismaService();
  const createdUserIds = new Set<string>();
  const pendingOperations = new Set<Promise<unknown>>();
  const cpf = "529.982.247-25";
  const bindingScope = "personal_identity_cpf";
  // Coordena apenas suítes cooperantes; a API e outros escritores devem estar
  // parados enquanto este banco de integração estiver em uso.
  const advisoryLockName = "soravi:integration:personal-identity-recording";
  let advisoryLockClient: Client | undefined;
  let advisoryLockAcquired = false;
  let suitePrepared = false;
  let originalBinding: {
    state: CpfHmacKeyBindingState;
    hmacKeyId: string | null;
    hmacKeyFingerprint: string | null;
  };

  beforeAll(async () => {
    advisoryLockClient = new Client({ connectionString: getIntegrationDatabaseUrl() });
    await advisoryLockClient.connect();
    const lockResult = await advisoryLockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [advisoryLockName],
    );
    if (!lockResult.rows[0]?.acquired) {
      throw new Error("Outra execução desta suíte de integração já está em andamento.");
    }
    advisoryLockAcquired = true;

    await Promise.all([controlPrisma.$connect(), firstPrisma.$connect(), secondPrisma.$connect()]);
    await assertNoIdentitiesOutsideFixtures();
    const binding = await controlPrisma.cpfHmacKeyBinding.findUnique({
      where: { scope: bindingScope },
      select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
    });
    if (!binding) throw new Error("A migration de vínculo HMAC deve estar aplicada no banco de integração.");
    originalBinding = binding;
    suitePrepared = true;
  });
  afterEach(async () => {
    await Promise.allSettled([...pendingOperations]);
    if (!suitePrepared) return;
    for (const userId of createdUserIds) {
      await controlPrisma.personalIdentity.deleteMany({ where: { userId } });
      await controlPrisma.user.deleteMany({ where: { id: userId } });
      createdUserIds.delete(userId);
    }
    await assertNoIdentitiesOutsideFixtures();
    await setBinding(CpfHmacKeyBindingState.UNINITIALIZED);
  });
  afterAll(async () => {
    try {
      await Promise.allSettled([...pendingOperations]);
      if (suitePrepared && originalBinding && createdUserIds.size === 0) {
        await assertNoIdentitiesOutsideFixtures();
        await controlPrisma.cpfHmacKeyBinding.update({
          where: { scope: bindingScope },
          data: originalBinding,
        });
      }
    } finally {
      try {
        if (advisoryLockAcquired) {
          await advisoryLockClient?.query(
            "SELECT pg_advisory_unlock(hashtext($1))",
            [advisoryLockName],
          );
        }
      } finally {
        await Promise.all([
          controlPrisma.$disconnect(),
          firstPrisma.$disconnect(),
          secondPrisma.$disconnect(),
          advisoryLockClient?.end(),
        ]);
      }
    }
  });

  beforeEach(async () => {
    if (!suitePrepared) throw new Error("A preparação da suíte de integração não foi concluída.");
    await assertNoIdentitiesOutsideFixtures();
    await setBinding(CpfHmacKeyBindingState.UNINITIALIZED);
  });

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

  it("allows exactly one account to claim the same CPF after the global lock", async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const first = service(firstPrisma);
    const second = service(secondPrisma);
    let firstOperation: Promise<unknown> | undefined;
    let secondOperation: Promise<unknown> | undefined;

    try {
      firstOperation = track(first.recordInitial(firstUserId, cpf));
      secondOperation = track(second.recordInitial(secondUserId, cpf));
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
      await settle(firstOperation, secondOperation);
    }
  });

  it("blocks a second transaction on the singleton before it reaches its user", async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const firstSingletonLocked = deferred<void>();
    const releaseFirst = deferred<void>();
    const blockedPid = deferred<number>();
    const first = service(wrapPrisma(firstPrisma, {
      afterQueryRaw: async (args) => {
        if (queryRawSql(args).includes('FROM "cpf_hmac_key_bindings"')) {
          firstSingletonLocked.resolve();
          await releaseFirst.promise;
        }
      },
    }));
    const second = service(wrapPrisma(secondPrisma, {
      transactionStarted: (pid) => blockedPid.resolve(pid),
    }));
    let firstOperation: Promise<unknown> | undefined;
    let secondOperation: Promise<unknown> | undefined;

    try {
      firstOperation = track(first.recordInitial(firstUserId, cpf));
      await firstSingletonLocked.promise;
      secondOperation = track(second.recordInitial(secondUserId, "111.444.777-35"));
      await waitUntilPostgresConfirmsBlocking(controlPrisma, await blockedPid.promise);

      releaseFirst.resolve();
      await expect(firstOperation).resolves.toEqual({ recorded: true });
      await expect(secondOperation).resolves.toEqual({ recorded: true });
      await expect(controlPrisma.cpfHmacKeyBinding.findUniqueOrThrow({
        where: { scope: bindingScope },
        select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
      })).resolves.toMatchObject({
        state: CpfHmacKeyBindingState.BOUND,
        hmacKeyId: "test-hmac-v1",
      });
    } finally {
      releaseFirst.resolve();
      await settle(firstOperation, secondOperation);
    }
  });

  it("binds the winner configuration and refuses a concurrent different configuration", async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();
    const firstSingletonLocked = deferred<void>();
    const releaseFirst = deferred<void>();
    const first = service(wrapPrisma(firstPrisma, {
      afterQueryRaw: async (args) => {
        if (queryRawSql(args).includes('FROM "cpf_hmac_key_bindings"')) {
          firstSingletonLocked.resolve();
          await releaseFirst.promise;
        }
      },
    }));
    const second = service(secondPrisma, Buffer.alloc(32, 9), "test-hmac-v2");
    let firstOperation: Promise<unknown> | undefined;
    let secondOperation: Promise<unknown> | undefined;

    try {
      firstOperation = track(first.recordInitial(firstUserId, cpf));
      await firstSingletonLocked.promise;
      secondOperation = track(second.recordInitial(secondUserId, "111.444.777-35"));
      releaseFirst.resolve();

      await expect(firstOperation).resolves.toEqual({ recorded: true });
      await expect(secondOperation).rejects.toMatchObject({
        response: expect.objectContaining({ code: "PERSONAL_IDENTITY_KEY_UNAVAILABLE" }),
      });
      await expect(controlPrisma.personalIdentity.count({ where: { userId: firstUserId } })).resolves.toBe(1);
      await expect(controlPrisma.personalIdentity.count({ where: { userId: secondUserId } })).resolves.toBe(0);
      await expect(controlPrisma.cpfHmacKeyBinding.findUniqueOrThrow({
        where: { scope: bindingScope },
        select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
      })).resolves.toEqual({
        state: CpfHmacKeyBindingState.BOUND,
        hmacKeyId: "test-hmac-v1",
        hmacKeyFingerprint: protector().hmacKeyFingerprint(),
      });
    } finally {
      releaseFirst.resolve();
      await settle(firstOperation, secondOperation);
    }
  });

  it("rolls back the initial binding when the first identity cannot be created", async () => {
    const userId = await createUser();
    const failingPrisma = failIdentityCreate(firstPrisma);

    await expect(service(failingPrisma).recordInitial(userId, cpf)).rejects.toThrow("integration-only");

    await expect(controlPrisma.cpfHmacKeyBinding.findUniqueOrThrow({
      where: { scope: bindingScope },
      select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
    })).resolves.toEqual({
      state: CpfHmacKeyBindingState.UNINITIALIZED,
      hmacKeyId: null,
      hmacKeyFingerprint: null,
    });
    await expect(controlPrisma.personalIdentity.count({ where: { userId } })).resolves.toBe(0);
  });

  it("refuses a missing or adoption-pending binding", async () => {
    const userId = await createUser();
    await controlPrisma.cpfHmacKeyBinding.update({
      where: { scope: bindingScope },
      data: { state: CpfHmacKeyBindingState.ADOPTION_REQUIRED, hmacKeyId: null, hmacKeyFingerprint: null },
    });
    await expect(service(firstPrisma).recordInitial(userId, cpf)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PERSONAL_IDENTITY_KEY_UNAVAILABLE" }),
    });
    await expect(controlPrisma.personalIdentity.count({ where: { userId } })).resolves.toBe(0);
    await expect(controlPrisma.cpfHmacKeyBinding.findUniqueOrThrow({
      where: { scope: bindingScope },
      select: { state: true, hmacKeyId: true, hmacKeyFingerprint: true },
    })).resolves.toEqual({
      state: CpfHmacKeyBindingState.ADOPTION_REQUIRED,
      hmacKeyId: null,
      hmacKeyFingerprint: null,
    });

    await controlPrisma.cpfHmacKeyBinding.delete({ where: { scope: bindingScope } });
    try {
      await expect(service(firstPrisma).recordInitial(userId, cpf)).rejects.toMatchObject({
        response: expect.objectContaining({ code: "PERSONAL_IDENTITY_KEY_UNAVAILABLE" }),
      });
      await expect(controlPrisma.personalIdentity.count({ where: { userId } })).resolves.toBe(0);
      await expect(controlPrisma.cpfHmacKeyBinding.findUnique({
        where: { scope: bindingScope },
      })).resolves.toBeNull();
    } finally {
      await controlPrisma.cpfHmacKeyBinding.create({
        data: { scope: bindingScope, state: CpfHmacKeyBindingState.UNINITIALIZED },
      });
    }
  });

  async function createUser(): Promise<string> {
    const id = randomUUID();
    const email = `personal-identity-${randomUUID()}@example.test`;
    createdUserIds.add(id);
    await controlPrisma.user.create({ data: { id, name: "Integration identity", email, emailNormalized: email, passwordHash: "integration-only", status: UserStatus.ACTIVE } });
    return id;
  }

  async function setBinding(state: CpfHmacKeyBindingState): Promise<void> {
    await controlPrisma.cpfHmacKeyBinding.update({
      where: { scope: bindingScope },
      data: { state, hmacKeyId: null, hmacKeyFingerprint: null },
    });
  }

  async function assertNoIdentitiesOutsideFixtures(): Promise<void> {
    const identities = await controlPrisma.personalIdentity.findMany({
      select: { userId: true },
    });
    if (identities.some((identity) => !createdUserIds.has(identity.userId))) {
      throw new Error("A suíte requer soravi_integration_test sem identidades fora das fixtures.");
    }
  }

  function service(
    prisma: PrismaService,
    hmacKey = Buffer.alloc(32, 4),
    hmacKeyId = "test-hmac-v1",
  ): PersonalIdentityRecordingService {
    return new PersonalIdentityRecordingService(prisma, protector(hmacKey), hmacKeyId);
  }

  function track<T>(operation: Promise<T>): Promise<T> {
    pendingOperations.add(operation);
    operation.then(() => pendingOperations.delete(operation), () => pendingOperations.delete(operation));
    return operation;
  }
});

function failIdentityCreate(prisma: PrismaService): PrismaService {
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
        async (transaction) => callback(gateTransactionIdentityCreate(transaction)),
        options,
      );
    },
  }) as PrismaService;
}

function gateTransactionIdentityCreate(transaction: Prisma.TransactionClient): Prisma.TransactionClient {
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property !== "personalIdentity") {
        const original = Reflect.get(target, property, receiver);
        return typeof original === "function" ? original.bind(target) : original;
      }
      return new Proxy(target.personalIdentity, {
        get(delegate, delegateProperty, delegateReceiver) {
          const original = Reflect.get(delegate, delegateProperty, delegateReceiver);
          if (delegateProperty !== "create") return typeof original === "function" ? original.bind(delegate) : original;
          return async () => { throw new Error("integration-only"); };
        },
      });
    },
  }) as Prisma.TransactionClient;
}

async function settle(...operations: Array<Promise<unknown> | undefined>): Promise<void> {
  await Promise.allSettled(operations.filter((operation): operation is Promise<unknown> => operation !== undefined));
}

function protector(hmacKey = Buffer.alloc(32, 4)) {
  return createCpfProtector({ encryptionKey: Buffer.alloc(32, 3), hmacKey, encryptionKeyId: "test-encryption-v1" });
}
