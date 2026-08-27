import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import { UserStatus } from "../../generated/prisma/client";
import { InvalidPhoneVerificationCodeException } from "./errors/invalid-phone-verification-code.exception";
import { PhoneVerificationCodeService } from "./phone-verification-code.service";
import { PhoneVerificationService } from "./phone-verification.service";

type UserFixture = {
  id: string;
  status: UserStatus;
  deletedAt: Date | null;
  phoneNormalized: string | null;
  phoneVerifiedAt: Date | null;
};

describe("PhoneVerificationService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const challengeId = "625afb87-2b81-4de7-9606-8f382fff3341";
  let service: PhoneVerificationService;
  let transactionMock: {
    $queryRaw: jest.Mock;
    user: { update: jest.Mock };
    phoneVerificationChallenge: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let prismaMock: { $transaction: jest.Mock };
  let codeServiceMock: {
    generateCode: jest.Mock;
    hashCode: jest.Mock;
    verifyCode: jest.Mock;
  };

  beforeEach(() => {
    transactionMock = {
      $queryRaw: jest.fn(),
      user: { update: jest.fn().mockResolvedValue({}) },
      phoneVerificationChallenge: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: challengeId }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
          callback(transactionMock),
      ),
    };
    codeServiceMock = {
      generateCode: jest.fn().mockReturnValue("012345"),
      hashCode: jest.fn().mockReturnValue("a".repeat(64)),
      verifyCode: jest.fn().mockReturnValue(true),
    };
    const configServiceMock = {
      get: jest.fn((key: string, fallback: number) => {
        const values: Record<string, number> = {
          PHONE_VERIFICATION_TTL_SECONDS: 600,
          PHONE_VERIFICATION_MAX_ATTEMPTS: 5,
          PHONE_VERIFICATION_COOLDOWN_SECONDS: 60,
        };

        return values[key] ?? fallback;
      }),
    };
    service = new PhoneVerificationService(
      prismaMock as unknown as PrismaService,
      codeServiceMock as unknown as PhoneVerificationCodeService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it("cria challenge com snapshot, hash, TTL e maxAttempts", async () => {
    transactionMock.$queryRaw.mockResolvedValue([createUser()]);
    const before = Date.now();

    await service.requestChallenge(userId);

    const data = transactionMock.phoneVerificationChallenge.create.mock
      .calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({
        userId,
        phoneNormalized: "+5521999999999",
        codeHash: "a".repeat(64),
        attemptCount: 0,
        maxAttempts: 5,
        consumedAt: null,
        invalidatedAt: null,
      }),
    );
    expect(data).not.toHaveProperty("code");
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 600_000);
    expect(codeServiceMock.hashCode).toHaveBeenCalledWith({
      challengeId: data.id,
      userId,
      phoneNormalized: "+5521999999999",
      code: "012345",
    });
  });

  it("invalida challenges ativos antes de criar o novo", async () => {
    transactionMock.$queryRaw.mockResolvedValue([createUser()]);

    await service.requestChallenge(userId);

    expect(transactionMock.phoneVerificationChallenge.updateMany)
      .toHaveBeenCalledWith({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: expect.any(Date) },
      });
    expect(
      transactionMock.phoneVerificationChallenge.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transactionMock.phoneVerificationChallenge.create.mock.invocationCallOrder[0],
    );
  });

  it.each<[string, ReturnType<typeof baseUser> | null]>([
    ["inexistente", null],
    ["sem telefone", createUser({ phoneNormalized: null })],
    ["deletado", createUser({ deletedAt: new Date() })],
    ["suspenso", createUser({ status: UserStatus.SUSPENDED })],
    ["já verificado", createUser({ phoneVerifiedAt: new Date() })],
  ])("retorna neutro para usuário %s sem criar challenge", async (_case, user) => {
    transactionMock.$queryRaw.mockResolvedValue(user ? [user] : []);

    await expect(service.requestChallenge(userId)).resolves.toBeUndefined();
    expect(transactionMock.phoneVerificationChallenge.create).not.toHaveBeenCalled();
  });

  it("respeita cooldown persistente", async () => {
    transactionMock.$queryRaw.mockResolvedValue([createUser()]);
    transactionMock.phoneVerificationChallenge.findFirst.mockResolvedValue({
      createdAt: new Date(),
    });

    await service.requestChallenge(userId);

    expect(transactionMock.phoneVerificationChallenge.create).not.toHaveBeenCalled();
    expect(codeServiceMock.generateCode).not.toHaveBeenCalled();
  });

  it("usa SELECT FOR UPDATE para bloquear o usuário no request", async () => {
    transactionMock.$queryRaw.mockResolvedValue([]);

    await service.requestChallenge(userId);

    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    expect(query.strings.join(" ")).toContain("FOR UPDATE");
    expect(query.values).toContain(userId);
  });

  it("confirma e atualiza User e challenge na mesma transaction", async () => {
    prepareConfirmation();

    await service.confirmCode(userId, "012345");

    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phoneVerifiedAt: expect.any(Date) },
    });
    expect(transactionMock.phoneVerificationChallenge.update)
      .toHaveBeenCalledWith({
        where: { id: challengeId },
        data: { consumedAt: expect.any(Date) },
      });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("código incorreto incrementa attemptCount", async () => {
    prepareConfirmation();
    codeServiceMock.verifyCode.mockReturnValue(false);

    await expect(service.confirmCode(userId, "999999")).rejects.toBeInstanceOf(
      InvalidPhoneVerificationCodeException,
    );
    expect(transactionMock.phoneVerificationChallenge.update)
      .toHaveBeenCalledWith({
        where: { id: challengeId },
        data: { attemptCount: { increment: 1 } },
      });
  });

  it("tentativa final também invalida o challenge", async () => {
    prepareConfirmation(createChallenge({ attemptCount: 4, maxAttempts: 5 }));
    codeServiceMock.verifyCode.mockReturnValue(false);

    await expect(service.confirmCode(userId, "999999")).rejects.toBeInstanceOf(
      InvalidPhoneVerificationCodeException,
    );
    expect(transactionMock.phoneVerificationChallenge.update)
      .toHaveBeenCalledWith({
        where: { id: challengeId },
        data: {
          attemptCount: { increment: 1 },
          invalidatedAt: expect.any(Date),
        },
      });
  });

  it.each<
    [
      string,
      ReturnType<typeof baseChallenge> | null,
      ReturnType<typeof baseUser> | null,
    ]
  >([
    ["inexistente", null, createUser()],
    [
      "expirado",
      createChallenge({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }),
      createUser(),
    ],
    ["telefone alterado", createChallenge(), createUser({ phoneNormalized: "+5511999999999" })],
    ["tentativas esgotadas", createChallenge({ attemptCount: 5 }), createUser()],
  ])("retorna o mesmo erro genérico para challenge %s", async (_case, challenge, user) => {
    transactionMock.$queryRaw
      .mockResolvedValueOnce(challenge ? [challenge] : [])
      .mockResolvedValueOnce(user ? [user] : []);

    await expect(service.confirmCode(userId, "012345")).rejects.toMatchObject({
      response: {
        code: "INVALID_PHONE_VERIFICATION_CODE",
        message: "Código de verificação inválido ou expirado.",
      },
    });
    if (challenge) {
      expect(transactionMock.phoneVerificationChallenge.update)
        .toHaveBeenCalledWith({
          where: { id: challengeId },
          data: { invalidatedAt: expect.any(Date) },
        });
    }
  });

  it("seleciona somente challenge ativo do usuário autenticado com lock", async () => {
    transactionMock.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.confirmCode(userId, "012345")).rejects.toBeInstanceOf(
      InvalidPhoneVerificationCodeException,
    );
    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    const sql = query.strings.join(" ");
    expect(sql).toContain('"user_id" =');
    expect(sql).toContain('"consumed_at" IS NULL');
    expect(sql).toContain('"invalidated_at" IS NULL');
    expect(sql).toContain('ORDER BY "created_at" DESC');
    expect(sql).toContain("FOR UPDATE");
    expect(query.values).toContain(userId);
  });

  function prepareConfirmation(
    challenge = createChallenge(),
    user = createUser(),
  ): void {
    transactionMock.$queryRaw
      .mockResolvedValueOnce([challenge])
      .mockResolvedValueOnce([user]);
  }

  function createUser(
    overrides: Partial<UserFixture> = {},
  ): UserFixture {
    return { ...baseUser(), ...overrides };
  }

  function baseUser(): UserFixture {
    return {
      id: userId,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      phoneNormalized: "+5521999999999",
      phoneVerifiedAt: null,
    };
  }

  function createChallenge(
    overrides: Partial<ReturnType<typeof baseChallenge>> = {},
  ): ReturnType<typeof baseChallenge> {
    return { ...baseChallenge(), ...overrides };
  }

  function baseChallenge() {
    return {
      id: challengeId,
      userId,
      phoneNormalized: "+5521999999999",
      codeHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 600_000),
      attemptCount: 0,
      maxAttempts: 5,
    };
  }
});
