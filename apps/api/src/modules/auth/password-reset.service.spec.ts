import { createHash } from "node:crypto";

import { argon2id, hash as hashPassword } from "argon2";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../../database/prisma.service";
import { UserStatus } from "../../generated/prisma/client";
import { PasswordResetInvalidOrExpiredException } from "./errors/password-reset-invalid-or-expired.exception";
import { PASSWORD_RESET_DELIVERY_PORT } from "./password-reset-delivery.port";
import { PasswordResetService } from "./password-reset.service";
import { SORAVI_COMMON_PASSWORDS_BLOCKLIST } from "./password-policy/common-passwords";
import { PasswordTooCommonException } from "./password-policy/password-too-common.exception";

type LockedUserFixture = {
  id: string;
  email: string;
  status: UserStatus;
  deletedAt: Date | null;
};

type LockedTokenFixture = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

jest.mock("argon2", () => ({
  argon2id: 2,
  hash: jest.fn(),
}));

describe("PasswordResetService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const tokenId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const email = "maria@example.com";
  const rawToken = "a".repeat(43);
  const rawTokenHash = createHash("sha256")
    .update(rawToken, "utf8")
    .digest("hex");
  const hashPasswordMock = jest.mocked(hashPassword);

  let service: PasswordResetService;
  let transactionMock: {
    $queryRaw: jest.Mock;
    user: { update: jest.Mock };
    passwordResetToken: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    authSession: { updateMany: jest.Mock };
  };
  let prismaMock: {
    user: { findUnique: jest.Mock };
    passwordResetToken: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let deliveryPortMock: { sendReset: jest.Mock };

  beforeEach(async () => {
    transactionMock = {
      $queryRaw: jest.fn(),
      user: { update: jest.fn().mockResolvedValue({ id: userId }) },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({ id: tokenId }),
        update: jest.fn().mockResolvedValue({ id: tokenId }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: userId }),
      },
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({ id: tokenId, userId }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(
        (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
          callback(transactionMock),
      ),
    };
    deliveryPortMock = {
      sendReset: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: PASSWORD_RESET_DELIVERY_PORT,
          useValue: deliveryPortMock,
        },
      ],
    }).compile();
    service = moduleRef.get(PasswordResetService);
    hashPasswordMock.mockResolvedValue("argon2id-hash");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cria token URL-safe, persiste somente SHA-256 e TTL de 30 minutos", async () => {
    transactionMock.$queryRaw.mockResolvedValue([lockedUser()]);
    const before = Date.now();

    await service.requestReset(email);

    const delivery = deliveryPortMock.sendReset.mock.calls[0][0] as {
      email: string;
      rawToken: string;
      expiresAt: Date;
    };
    const persisted = transactionMock.passwordResetToken.create.mock
      .calls[0][0].data;
    expect(delivery.email).toBe(email);
    expect(delivery.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(persisted).toEqual({
      userId,
      tokenHash: createHash("sha256")
        .update(delivery.rawToken, "utf8")
        .digest("hex"),
      expiresAt: expect.any(Date),
      usedAt: null,
    });
    expect(JSON.stringify(persisted)).not.toContain(delivery.rawToken);
    expect(persisted.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 1_800_000,
    );
    expect(persisted.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 1_800_000,
    );
  });

  it("invalida token anterior ativo antes de criar o novo", async () => {
    transactionMock.$queryRaw.mockResolvedValue([lockedUser()]);

    await service.requestReset(email);

    expect(transactionMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(
      transactionMock.passwordResetToken.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      transactionMock.passwordResetToken.create.mock.invocationCallOrder[0],
    );
  });

  it("permite solicitar reset para usuário PENDING", async () => {
    transactionMock.$queryRaw.mockResolvedValue([
      lockedUser({ status: UserStatus.PENDING }),
    ]);

    await service.requestReset(email);

    expect(transactionMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(deliveryPortMock.sendReset).toHaveBeenCalledTimes(1);
  });

  it("chama delivery somente depois do commit", async () => {
    transactionMock.$queryRaw.mockResolvedValue([lockedUser()]);
    let transactionCompleted = false;
    prismaMock.$transaction.mockImplementationOnce(
      async (
        callback: (transaction: typeof transactionMock) => Promise<unknown>,
      ) => {
        const result = await callback(transactionMock);
        transactionCompleted = true;
        return result;
      },
    );
    deliveryPortMock.sendReset.mockImplementation(() => {
      expect(transactionCompleted).toBe(true);
      return Promise.resolve();
    });

    await service.requestReset(email);
  });

  it.each([
    ["email inexistente", null, null],
    ["soft-deleted", { id: userId }, lockedUser({ deletedAt: new Date() })],
    ["SUSPENDED", { id: userId }, lockedUser({ status: UserStatus.SUSPENDED })],
    ["BLOCKED", { id: userId }, lockedUser({ status: UserStatus.BLOCKED })],
    ["DEACTIVATED", { id: userId }, lockedUser({ status: UserStatus.DEACTIVATED })],
  ])("retorna neutro para %s sem token ou delivery", async (_case, candidate, user) => {
    prismaMock.user.findUnique.mockResolvedValue(candidate);
    transactionMock.$queryRaw.mockResolvedValue(user ? [user] : []);

    await expect(service.requestReset(email)).resolves.toBeUndefined();
    expect(transactionMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(deliveryPortMock.sendReset).not.toHaveBeenCalled();
  });

  it("normaliza lookup recebido sem incluir identidade em resultado", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await service.requestReset(email);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { emailNormalized: email },
      select: { id: true },
    });
  });

  it("falha de delivery é neutra e invalida somente o token criado", async () => {
    transactionMock.$queryRaw.mockResolvedValue([lockedUser()]);
    deliveryPortMock.sendReset.mockRejectedValue(new Error("provider secret"));

    await expect(service.requestReset(email)).resolves.toBeUndefined();
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: tokenId, userId, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("token válido redefine senha, invalida tokens e revoga todas as sessões", async () => {
    prepareConfirmation();

    await service.confirmReset(rawToken, "SenhaSegura1");

    expect(hashPasswordMock).toHaveBeenCalledWith("SenhaSegura1", {
      type: argon2id,
    });
    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: "argon2id-hash" },
      select: { id: true },
    });
    expect(transactionMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: tokenId },
      data: { usedAt: expect.any(Date) },
      select: { id: true },
    });
    expect(transactionMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId, id: { not: tokenId }, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(transactionMock.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("token válido com senha comum retorna PASSWORD_TOO_COMMON sem alterar nada", async () => {
    prepareConfirmation();

    await expect(
      service.confirmReset(rawToken, SORAVI_COMMON_PASSWORDS_BLOCKLIST[0]),
    ).rejects.toBeInstanceOf(PasswordTooCommonException);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(transactionMock.user.update).not.toHaveBeenCalled();
    expect(transactionMock.passwordResetToken.update).not.toHaveBeenCalled();
    expect(
      transactionMock.passwordResetToken.updateMany,
    ).not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("token inexistente retorna o erro público genérico sem transação", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(
      service.confirmReset(rawToken, "SenhaSegura1"),
    ).rejects.toBeInstanceOf(PasswordResetInvalidOrExpiredException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["expirado", lockedToken({ expiresAt: new Date("2020-01-01") }), lockedUser()],
    ["usado", lockedToken({ usedAt: new Date() }), lockedUser()],
    ["usuário inelegível", lockedToken(), lockedUser({ status: UserStatus.BLOCKED })],
    ["usuário excluído", lockedToken(), lockedUser({ deletedAt: new Date() })],
  ])("rejeita token %s com o mesmo erro", async (_case, token, user) => {
    transactionMock.$queryRaw
      .mockResolvedValueOnce([user])
      .mockResolvedValueOnce([token]);

    await expect(
      service.confirmReset(rawToken, "SenhaSegura1"),
    ).rejects.toMatchObject({
      response: { code: "PASSWORD_RESET_INVALID_OR_EXPIRED" },
    });
    expect(transactionMock.user.update).not.toHaveBeenCalled();
  });

  it("bloqueia User antes de PasswordResetToken", async () => {
    prepareConfirmation();

    await service.confirmReset(rawToken, "SenhaSegura1");

    const userSql = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
    };
    const tokenSql = transactionMock.$queryRaw.mock.calls[1][0] as {
      strings: readonly string[];
    };
    expect(userSql.strings.join(" ")).toContain('FROM "users"');
    expect(tokenSql.strings.join(" ")).toContain(
      'FROM "password_reset_tokens"',
    );
    expect(userSql.strings.join(" ")).toContain("FOR UPDATE");
    expect(tokenSql.strings.join(" ")).toContain("FOR UPDATE");
  });

  it("token não pode ser reutilizado", async () => {
    prepareConfirmation();
    await service.confirmReset(rawToken, "SenhaSegura1");
    transactionMock.$queryRaw
      .mockResolvedValueOnce([lockedUser()])
      .mockResolvedValueOnce([lockedToken({ usedAt: new Date() })]);

    await expect(
      service.confirmReset(rawToken, "OutraSenha2"),
    ).rejects.toBeInstanceOf(PasswordResetInvalidOrExpiredException);
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);
  });

  it("duas confirmações concorrentes permitem somente um consumo", async () => {
    let tokenUsedAt: Date | null = null;
    let transactionQueue = Promise.resolve();
    transactionMock.$queryRaw.mockImplementation((query: {
      strings: readonly string[];
    }) => {
      const sql = query.strings.join(" ");

      return Promise.resolve(
        sql.includes('FROM "users"')
          ? [lockedUser()]
          : [lockedToken({ usedAt: tokenUsedAt })],
      );
    });
    transactionMock.passwordResetToken.update.mockImplementation(
      ({ data }: { data: { usedAt: Date } }) => {
        tokenUsedAt = data.usedAt;
        return Promise.resolve({ id: tokenId });
      },
    );
    prismaMock.$transaction.mockImplementation(
      <T>(callback: (transaction: typeof transactionMock) => Promise<T>) => {
        const result = transactionQueue.then(() => callback(transactionMock));
        transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    );

    const results = await Promise.allSettled([
      service.confirmReset(rawToken, "SenhaSegura1"),
      service.confirmReset(rawToken, "OutraSenha2"),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(hashPasswordMock).toHaveBeenCalledTimes(1);
  });

  it("propaga falha transacional sem retornar sucesso parcial", async () => {
    prepareConfirmation();
    transactionMock.authSession.updateMany.mockRejectedValue(
      new Error("transaction failed"),
    );

    await expect(
      service.confirmReset(rawToken, "SenhaSegura1"),
    ).rejects.toThrow("transaction failed");
  });

  function prepareConfirmation(): void {
    transactionMock.$queryRaw
      .mockResolvedValueOnce([lockedUser()])
      .mockResolvedValueOnce([lockedToken()]);
  }

  function lockedUser(
    overrides: Partial<LockedUserFixture> = {},
  ): LockedUserFixture {
    return { ...baseLockedUser(), ...overrides };
  }

  function baseLockedUser(): LockedUserFixture {
    return {
      id: userId,
      email,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    };
  }

  function lockedToken(
    overrides: Partial<LockedTokenFixture> = {},
  ): LockedTokenFixture {
    return { ...baseLockedToken(), ...overrides };
  }

  function baseLockedToken(): LockedTokenFixture {
    return {
      id: tokenId,
      userId,
      tokenHash: rawTokenHash,
      expiresAt: new Date(Date.now() + 1_800_000),
      usedAt: null,
    };
  }
});
