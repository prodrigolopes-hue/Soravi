import {
  argon2id,
  hash as hashPassword,
  verify as verifyPassword,
} from "argon2";

import { PrismaService } from "../../database/prisma.service";
import { PasswordTooCommonException } from "../auth/password-policy/password-too-common.exception";
import { ensurePasswordIsAllowed } from "../auth/password-policy/password-policy";
import { InvalidCurrentPasswordException } from "./errors/invalid-current-password.exception";
import { NewPasswordMustDifferException } from "./errors/new-password-must-differ.exception";
import { UserNotFoundException } from "./errors/user-not-found.exception";
import { UsersPasswordService } from "./users-password.service";

jest.mock("argon2", () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("../auth/password-policy/password-policy", () => {
  const actual = jest.requireActual("../auth/password-policy/password-policy");

  return {
    ...actual,
    ensurePasswordIsAllowed: jest.fn(),
  };
});

describe("UsersPasswordService.updateCurrentUserPassword", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const currentSessionId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const passwordHash = "hash-atual";
  const newPasswordHash = "novo-hash-argon2id";
  const verifyPasswordMock = jest.mocked(verifyPassword);
  const hashPasswordMock = jest.mocked(hashPassword);
  const ensurePasswordIsAllowedMock = jest.mocked(ensurePasswordIsAllowed);

  let service: UsersPasswordService;
  let transactionMock: {
    $queryRaw: jest.Mock;
    user: { update: jest.Mock };
    passwordResetToken: { updateMany: jest.Mock };
    authSession: { updateMany: jest.Mock };
  };
  let prismaMock: {
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    transactionMock = {
      $queryRaw: jest.fn().mockResolvedValue([lockedUser()]),
      user: { update: jest.fn().mockResolvedValue({ id: userId }) },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    prismaMock = {
      $transaction: jest.fn(
        (callback: (transaction: typeof transactionMock) => Promise<void>) =>
          callback(transactionMock),
      ),
    };
    service = new UsersPasswordService(
      prismaMock as unknown as PrismaService,
    );
    verifyPasswordMock.mockResolvedValue(true);
    hashPasswordMock.mockResolvedValue(newPasswordHash);
    ensurePasswordIsAllowedMock.mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("atualiza senha, invalida resets e revoga outras sessões na mesma transação", async () => {
    const result = await service.updateCurrentUserPassword(
      userId,
      currentSessionId,
      input(),
    );

    expect(result).toBeUndefined();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(lockSql()).toContain('FROM "users"');
    expect(lockSql()).toContain('"password_hash" AS "passwordHash"');
    expect(lockSql()).toContain('"deleted_at" IS NULL');
    expect(lockSql()).toContain("FOR UPDATE");
    expect(lockValues()).toContain(userId);
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      passwordHash,
      "senha atual",
    );
    expect(ensurePasswordIsAllowedMock).toHaveBeenCalledWith("nova senha ok");
    expect(hashPasswordMock).toHaveBeenCalledWith("nova senha ok", {
      type: argon2id,
    });
    expect(transactionMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
      select: { id: true },
    });
    expect(transactionMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId, usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(transactionMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });

    const tokenTimestamp = transactionMock.passwordResetToken
      .updateMany.mock.calls[0][0].data.usedAt;
    const sessionTimestamp = transactionMock.authSession
      .updateMany.mock.calls[0][0].data.revokedAt;
    expect(sessionTimestamp).toBe(tokenTimestamp);
  });

  it("senha atual incorreta não aplica política, hash ou updates", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, input()),
    ).rejects.toBeInstanceOf(InvalidCurrentPasswordException);

    expect(ensurePasswordIsAllowedMock).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expectNoUpdates();
  });

  it("senha nova igual à atual retorna NEW_PASSWORD_MUST_DIFFER sem modificar estado", async () => {
    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, {
        currentPassword: "mesma senha",
        newPassword: "mesma senha",
      }),
    ).rejects.toBeInstanceOf(NewPasswordMustDifferException);

    expect(ensurePasswordIsAllowedMock).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expectNoUpdates();
  });

  it("senha comum não gera hash nem modifica estado", async () => {
    ensurePasswordIsAllowedMock.mockImplementation(() => {
      throw new PasswordTooCommonException();
    });

    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, input()),
    ).rejects.toBeInstanceOf(PasswordTooCommonException);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expectNoUpdates();
  });

  it("usuário inexistente ou deletado retorna UserNotFound sem modificar estado", async () => {
    transactionMock.$queryRaw.mockResolvedValue([]);

    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, input()),
    ).rejects.toBeInstanceOf(UserNotFoundException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(ensurePasswordIsAllowedMock).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expectNoUpdates();
  });

  it("falha ao invalidar tokens rejeita sem revogar sessões", async () => {
    transactionMock.passwordResetToken.updateMany.mockRejectedValue(
      new Error("reset token update failed"),
    );

    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, input()),
    ).rejects.toThrow("reset token update failed");

    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("falha ao revogar outras sessões rejeita a operação", async () => {
    transactionMock.authSession.updateMany.mockRejectedValue(
      new Error("session revoke failed"),
    );

    await expect(
      service.updateCurrentUserPassword(userId, currentSessionId, input()),
    ).rejects.toThrow("session revoke failed");
  });

  it("bloqueia o usuário antes de verificar ou modificar credenciais", async () => {
    await service.updateCurrentUserPassword(userId, currentSessionId, input());

    expect(transactionMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      verifyPasswordMock.mock.invocationCallOrder[0],
    );
    expect(verifyPasswordMock.mock.invocationCallOrder[0]).toBeLessThan(
      transactionMock.user.update.mock.invocationCallOrder[0],
    );
  });

  it("não expõe senha nem hash no retorno", async () => {
    const result = await service.updateCurrentUserPassword(
      userId,
      currentSessionId,
      input(),
    );

    expect(result).toBeUndefined();
    const serializedResult = String(result);
    expect(serializedResult).not.toContain("senha atual");
    expect(serializedResult).not.toContain("nova senha ok");
    expect(serializedResult).not.toContain(passwordHash);
    expect(serializedResult).not.toContain(newPasswordHash);
  });

  function input() {
    return {
      currentPassword: "senha atual",
      newPassword: "nova senha ok",
    };
  }

  function lockedUser() {
    return {
      id: userId,
      passwordHash,
    };
  }

  function lockSql() {
    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      strings: readonly string[];
    };

    return query.strings.join(" ");
  }

  function lockValues() {
    const query = transactionMock.$queryRaw.mock.calls[0][0] as {
      values: unknown[];
    };

    return query.values;
  }

  function expectNoUpdates() {
    expect(transactionMock.user.update).not.toHaveBeenCalled();
    expect(transactionMock.passwordResetToken.updateMany).not.toHaveBeenCalled();
    expect(transactionMock.authSession.updateMany).not.toHaveBeenCalled();
  }
});