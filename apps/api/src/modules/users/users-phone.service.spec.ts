import { verify as verifyPassword } from "argon2";
import { HttpException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { PhoneAlreadyInUseException } from "../auth/errors/phone-already-in-use.exception";
import { InvalidBrazilianPhoneException } from "./errors/invalid-brazilian-phone.exception";
import { InvalidCurrentPasswordException } from "./errors/invalid-current-password.exception";
import { UsersPhoneService } from "./users-phone.service";
import { UsersService } from "./users.service";

jest.mock("argon2", () => ({
  verify: jest.fn(),
}));

describe("UsersPhoneService.updateCurrentUserPhone", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const currentSessionId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const passwordHash = "hash-seguro";
  const verifiedAt = new Date("2026-08-29T10:00:00.000Z");
  const verifyPasswordMock = jest.mocked(verifyPassword);

  let service: UsersPhoneService;
  let transactionMock: {
    $queryRaw: jest.Mock;
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    phoneVerificationChallenge: {
      updateMany: jest.Mock;
    };
    authSession: {
      updateMany: jest.Mock;
    };
  };
  let prismaMock: {
    $transaction: jest.Mock;
  };
  let usersServiceMock: {
    findSafeById: jest.Mock;
  };

  beforeEach(() => {
    transactionMock = {
      $queryRaw: jest.fn().mockResolvedValue([lockedUser()]),
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      phoneVerificationChallenge: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        (callback: (transaction: typeof transactionMock) => Promise<void>) =>
          callback(transactionMock),
      ),
    };
    usersServiceMock = {
      findSafeById: jest.fn().mockResolvedValue({ data: { id: userId } }),
    };
    service = new UsersPhoneService(
      prismaMock as unknown as PrismaService,
      usersServiceMock as unknown as UsersService,
    );
    verifyPasswordMock.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("normaliza e executa todos os efeitos da mudança real na mesma transação", async () => {
    await service.updateCurrentUserPhone(userId, currentSessionId, input());

    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        phone: "(11) 98888-7777",
        phoneNormalized: "+5511988887777",
        phoneVerifiedAt: null,
      },
    });
    expect(transactionMock.phoneVerificationChallenge.updateMany)
      .toHaveBeenCalledWith({
        where: { userId, consumedAt: null, invalidatedAt: null },
        data: { invalidatedAt: expect.any(Date) },
      });
    expect(transactionMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });

    const challengeTimestamp = transactionMock.phoneVerificationChallenge
      .updateMany.mock.calls[0][0].data.invalidatedAt;
    const sessionTimestamp = transactionMock.authSession
      .updateMany.mock.calls[0][0].data.revokedAt;
    expect(sessionTimestamp).toBe(challengeTimestamp);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("confirma a senha atual com Argon2 sem retorná-la", async () => {
    const result = await service.updateCurrentUserPhone(
      userId,
      currentSessionId,
      input(),
    );

    expect(verifyPasswordMock).toHaveBeenCalledWith(
      passwordHash,
      "senha atual",
    );
    expect(JSON.stringify(result)).not.toContain("senha atual");
    expect(JSON.stringify(result)).not.toContain(passwordHash);
  });

  it("senha incorreta encerra a transação sem modificar estado", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      service.updateCurrentUserPhone(userId, currentSessionId, input()),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordException);
    expect(transactionMock.user.update).not.toHaveBeenCalled();
    expect(transactionMock.phoneVerificationChallenge.updateMany)
      .not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("mesmo número normalizado atualiza só a apresentação", async () => {
    transactionMock.$queryRaw.mockResolvedValue([
      lockedUser({
        phone: "+5521999999999",
        phoneNormalized: "+5521999999999",
      }),
    ]);

    await service.updateCurrentUserPhone(userId, currentSessionId, {
      phone: "(21) 99999-9999",
      currentPassword: "senha atual",
    });

    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { phone: "(21) 99999-9999" },
    });
    expect(transactionMock.phoneVerificationChallenge.updateMany)
      .not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("mesma apresentação e número é no-op completo", async () => {
    await service.updateCurrentUserPhone(userId, currentSessionId, {
      phone: "(21) 99999-9999",
      currentPassword: "senha atual",
    });

    expect(transactionMock.user.update).not.toHaveBeenCalled();
    expect(transactionMock.phoneVerificationChallenge.updateMany)
      .not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejeita telefone pertencente a outro usuário sem expor dados", async () => {
    transactionMock.user.findFirst.mockResolvedValue({ id: "outro-id" });

    const error = await service
      .updateCurrentUserPhone(userId, currentSessionId, input())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PhoneAlreadyInUseException);
    if (!(error instanceof HttpException)) {
      throw error;
    }

    const serializedResponse = JSON.stringify(error.getResponse());
    expect(serializedResponse).toContain("PHONE_ALREADY_IN_USE");
    expect(serializedResponse).not.toContain("outro-id");
    expect(transactionMock.user.update).not.toHaveBeenCalled();
  });

  it("converte corrida P2002 da constraint em PHONE_ALREADY_IN_USE", async () => {
    const error = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      {
        code: "P2002",
        meta: { target: ["phone_normalized"] },
      },
    ) as Prisma.PrismaClientKnownRequestError;
    transactionMock.user.update.mockRejectedValue(error);

    await expect(
      service.updateCurrentUserPhone(userId, currentSessionId, input()),
    ).rejects.toMatchObject({
      response: { code: "PHONE_ALREADY_IN_USE" },
    });
  });

  it("propaga falha transacional sem buscar ou retornar estado parcial", async () => {
    transactionMock.phoneVerificationChallenge.updateMany.mockRejectedValue(
      new Error("transaction failed"),
    );

    await expect(
      service.updateCurrentUserPhone(userId, currentSessionId, input()),
    ).rejects.toThrow("transaction failed");
    expect(usersServiceMock.findSafeById).not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejeita telefone inválido antes de abrir transação", async () => {
    await expect(
      service.updateCurrentUserPhone(userId, currentSessionId, {
        phone: "99999-9999",
        currentPassword: "senha atual",
      }),
    ).rejects.toBeInstanceOf(InvalidBrazilianPhoneException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("aceita entrada E.164 canônica", async () => {
    await service.updateCurrentUserPhone(userId, currentSessionId, {
      phone: "+5511988887777",
      currentPassword: "senha atual",
    });

    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: {
        phone: "+5511988887777",
        phoneNormalized: "+5511988887777",
        phoneVerifiedAt: null,
      },
    });
  });

  it("bloqueia o usuário antes de consultar ou modificar challenges", async () => {
    await service.updateCurrentUserPhone(userId, currentSessionId, input());

    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
      values: unknown[];
    };
    expect(query.strings.join(" ")).toContain("FOR UPDATE");
    expect(query.values).toContain(userId);
    expect(transactionMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transactionMock.phoneVerificationChallenge.updateMany
        .mock.invocationCallOrder[0],
    );
  });

  function input() {
    return {
      phone: "(11) 98888-7777",
      currentPassword: "senha atual",
    };
  }

  function lockedUser(
    overrides: Partial<ReturnType<typeof baseLockedUser>> = {},
  ) {
    return { ...baseLockedUser(), ...overrides };
  }

  function baseLockedUser() {
    return {
      id: userId,
      passwordHash,
      phone: "(21) 99999-9999",
      phoneNormalized: "+5521999999999",
      phoneVerifiedAt: verifiedAt,
    };
  }
});
