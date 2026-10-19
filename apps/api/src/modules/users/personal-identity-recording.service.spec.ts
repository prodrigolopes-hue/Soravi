import { createCpfProtector } from "../../common/cpf/cpf-protection";
import { PrismaService } from "../../database/prisma.service";
import {
  CpfHmacKeyBindingState,
  Prisma,
  UserStatus,
} from "../../generated/prisma/client";
import { PersonalIdentityChangeUnavailableException } from "./errors/personal-identity-change-unavailable.exception";
import { PersonalIdentityCpfUnavailableException } from "./errors/personal-identity-cpf-unavailable.exception";
import { PersonalIdentityKeyUnavailableException } from "./errors/personal-identity-key-unavailable.exception";
import { PersonalIdentityPersistenceException } from "./errors/personal-identity-persistence.exception";
import { PersonalIdentityUnavailableException } from "./errors/personal-identity-unavailable.exception";
import { PersonalIdentityRecordingService } from "./personal-identity-recording.service";

const hmacKeyId = "test-hmac-v1";

describe("PersonalIdentityRecordingService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const cpf = "529.982.247-25";
  let transaction: any;
  let service: PersonalIdentityRecordingService;

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: userId }]),
      cpfHmacKeyBinding: {
        findUnique: jest.fn().mockResolvedValue(boundBinding()),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: userId, personalIdentity: null }) },
      personalIdentity: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "identity-id" }),
      },
    };
    const prisma = { $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
    service = new PersonalIdentityRecordingService(prisma as unknown as PrismaService, protector(), hmacKeyId);
  });

  it("creates only protected CPF material for an eligible account", async () => {
    await expect(service.recordInitial(userId, cpf)).resolves.toEqual({ recorded: true });

    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] } }),
    }));
    const data = transaction.personalIdentity.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ userId, hmacKeyId, cpfHmac: expect.any(String), cpfEnvelope: expect.any(Object) }));
    expect(JSON.stringify(data)).not.toContain("52998224725");
    expect(JSON.stringify(data)).not.toContain(cpf);
    expect(protector().decrypt(data.cpfEnvelope)).toBe("52998224725");
  });

  it("initializes the empty global binding and creates the first identity atomically", async () => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue(uninitializedBinding());

    await expect(service.recordInitial(userId, cpf)).resolves.toEqual({ recorded: true });

    expect(transaction.cpfHmacKeyBinding.update).toHaveBeenCalledWith({
      where: { scope: "personal_identity_cpf" },
      data: expect.objectContaining({
        state: CpfHmacKeyBindingState.BOUND,
        hmacKeyId,
        hmacKeyFingerprint: protector().hmacKeyFingerprint(),
      }),
    });
    expect(transaction.personalIdentity.create).toHaveBeenCalled();
  });

  it("accepts a compatible global binding without changing it", async () => {
    await expect(service.recordInitial(userId, cpf)).resolves.toEqual({ recorded: true });

    expect(transaction.cpfHmacKeyBinding.update).not.toHaveBeenCalled();
  });

  it.each([
    ["another key identifier", { ...boundBinding(), hmacKeyId: "test-hmac-v2" }],
    ["another key material", { ...boundBinding(), hmacKeyFingerprint: "a".repeat(64) }],
  ])("refuses a binding with %s", async (_description, binding) => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue(binding);

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityKeyUnavailableException);
    expect(transaction.personalIdentity.findFirst).not.toHaveBeenCalled();
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses adoption pending without changing the binding", async () => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue({
      ...uninitializedBinding(),
      state: CpfHmacKeyBindingState.ADOPTION_REQUIRED,
    });

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityKeyUnavailableException);
    expect(transaction.cpfHmacKeyBinding.update).not.toHaveBeenCalled();
  });

  it("refuses a missing singleton instead of recreating it", async () => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue(null);

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityKeyUnavailableException);
    expect(transaction.cpfHmacKeyBinding.update).not.toHaveBeenCalled();
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses to initialize when an identity already exists", async () => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue(uninitializedBinding());
    transaction.personalIdentity.count.mockResolvedValue(1);

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityKeyUnavailableException);
    expect(transaction.cpfHmacKeyBinding.update).not.toHaveBeenCalled();
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });

  it("does not initialize the binding for an ineligible user", async () => {
    transaction.cpfHmacKeyBinding.findUnique.mockResolvedValue(uninitializedBinding());
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityUnavailableException);
    expect(transaction.personalIdentity.count).not.toHaveBeenCalled();
    expect(transaction.cpfHmacKeyBinding.update).not.toHaveBeenCalled();
  });

  it("locks the global binding before locking the user", async () => {
    await service.recordInitial(userId, cpf);

    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(transaction.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain(
      'FROM "cpf_hmac_key_bindings"',
    );
    expect(transaction.$queryRaw.mock.calls[1][0].strings.join(" ")).toContain(
      'FROM "users"',
    );
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.$queryRaw.mock.invocationCallOrder[1],
    );
  });

  it("is idempotent for the same CPF without overwriting the identity", async () => {
    const existing = { cpfHmac: protector().hmac("52998224725"), hmacKeyId };
    transaction.user.findFirst.mockResolvedValue({ id: userId, personalIdentity: existing });

    await expect(service.recordInitial(userId, cpf)).resolves.toEqual({ recorded: true });

    expect(transaction.personalIdentity.findFirst).not.toHaveBeenCalled();
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses a CPF change after the initial identity is recorded", async () => {
    transaction.user.findFirst.mockResolvedValue({ id: userId, personalIdentity: { cpfHmac: "a".repeat(64), hmacKeyId } });

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityChangeUnavailableException);
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });

  it("refuses an identity created with a different HMAC key identifier", async () => {
    transaction.user.findFirst.mockResolvedValue({ id: userId, personalIdentity: { cpfHmac: "a".repeat(64), hmacKeyId: "test-hmac-v0" } });

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityKeyUnavailableException);
    expect(transaction.personalIdentity.findFirst).not.toHaveBeenCalled();
  });

  it("maps the adapter-pg CPF HMAC unique conflict to the neutral CPF conflict", async () => {
    transaction.personalIdentity.create.mockRejectedValue(adapterUniqueConstraintError(["cpf_hmac"]));

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityCpfUnavailableException);
  });

  it("does not classify the adapter-pg user_id unique conflict as a CPF conflict", async () => {
    transaction.personalIdentity.create.mockRejectedValue(adapterUniqueConstraintError(["user_id"]));

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityPersistenceException);
  });

  it.each(["missing", "deleted", "ineligible"])("refuses an %s account", async () => {
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(service.recordInitial(userId, cpf)).rejects.toBeInstanceOf(PersonalIdentityUnavailableException);
    expect(transaction.personalIdentity.create).not.toHaveBeenCalled();
  });
});

function protector() {
  return createCpfProtector({
    encryptionKey: Buffer.alloc(32, 1),
    hmacKey: Buffer.alloc(32, 2),
    encryptionKeyId: "test-encryption-v1",
  });
}

function boundBinding() {
  return {
    state: CpfHmacKeyBindingState.BOUND,
    hmacKeyId,
    hmacKeyFingerprint: protector().hmacKeyFingerprint(),
  };
}

function uninitializedBinding() {
  return {
    state: CpfHmacKeyBindingState.UNINITIALIZED,
    hmacKeyId: null,
    hmacKeyFingerprint: null,
  };
}

function adapterUniqueConstraintError(fields: string[]): Prisma.PrismaClientKnownRequestError {
  return Object.assign(
    Object.create(Prisma.PrismaClientKnownRequestError.prototype),
    {
      code: "P2002",
      meta: {
        modelName: "PersonalIdentity",
        driverAdapterError: {
          cause: { kind: "UniqueConstraintViolation", constraint: { fields } },
        },
      },
    },
  ) as Prisma.PrismaClientKnownRequestError;
}
