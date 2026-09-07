import { argon2id } from "argon2";

import { Role } from "../src/generated/prisma/client";
import {
  AdminPasswordOperationError,
  type AdminPasswordPrismaClient,
  normalizeAdminEmail,
  runSetAdminPasswordCommand,
  setAdminPassword,
  validateAdminPassword,
  validateDatabaseUrl,
  validatePasswordConfirmation,
} from "./set-admin-password";

function createPrismaMock(options?: {
  missing?: boolean;
  deleted?: boolean;
  roles?: Role[];
}) {
  const transaction = {
    user: {
      findUnique: jest.fn().mockResolvedValue(
        options?.missing
          ? null
          : {
              id: "admin-id",
              deletedAt: options?.deleted ? new Date() : null,
              roles: (options?.roles ?? [Role.ADMIN]).map((role) => ({ role })),
            },
      ),
      update: jest.fn().mockResolvedValue({ id: "admin-id" }),
    },
    authSession: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    passwordResetToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation) => operation(transaction)),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  } as unknown as AdminPasswordPrismaClient;

  return { prisma, transaction };
}

describe("set-admin-password", () => {
  it("normaliza o e-mail e rejeita valor vazio", () => {
    expect(normalizeAdminEmail("  ADMIN@Soravi.COM  ")).toBe("admin@soravi.com");
    expect(() => normalizeAdminEmail("   ")).toThrow(AdminPasswordOperationError);
  });

  it("falha sem DATABASE_URL antes de solicitar senha e sem expor seu valor", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.ADMIN_EMAIL = "admin@soravi.com";
    delete process.env.DATABASE_URL;
    const promptHidden = jest.fn();
    const createPrisma = jest.fn();
    const logError = jest.fn();

    try {
      const exitCode = await runSetAdminPasswordCommand({
        createPrisma,
        promptHidden,
        log: jest.fn(),
        logError,
      });

      expect(exitCode).toBe(1);
      expect(promptHidden).not.toHaveBeenCalled();
      expect(createPrisma).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(
        "DATABASE_URL não está definida no ambiente.",
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain("undefined");
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("falha sem ADMIN_EMAIL antes de solicitar senha ou acessar o banco", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = "postgresql://secret-admin-email-test";
    delete process.env.ADMIN_EMAIL;
    process.env.DATABASE_URL = databaseUrl;
    const promptHidden = jest.fn();
    const createPrisma = jest.fn();
    const logError = jest.fn();

    try {
      const exitCode = await runSetAdminPasswordCommand({
        createPrisma,
        promptHidden,
        log: jest.fn(),
        logError,
      });

      expect(exitCode).toBe(1);
      expect(promptHidden).not.toHaveBeenCalled();
      expect(createPrisma).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(
        "Defina ADMIN_EMAIL com o e-mail da conta ADMIN.",
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain(databaseUrl);
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("rejeita DATABASE_URL vazia", () => {
    expect(() => validateDatabaseUrl("   ")).toThrow(
      "DATABASE_URL não está definida no ambiente.",
    );
  });

  it.each([
    ["Curta123", "pelo menos 12"],
    [`A1${"x".repeat(127)}`, "no máximo 128"],
    ["123456789012", "menos comum"],
    ["abcdefghijkl", "menos comum"],
  ])("rejeita senha fora da política", (password, expectedMessage) => {
    expect(() => validateAdminPassword(password)).toThrow(expectedMessage);
  });

  it.each([["zqxjkvbnmwpl"], ["581047293618"]])(
    "aceita senha somente letras ou somente números quando não é comum",
    (password) => {
      expect(() => validateAdminPassword(password)).not.toThrow();
    },
  );

  it("rejeita confirmação diferente", () => {
    expect(() =>
      validatePasswordConfirmation("SenhaSegura123", "SenhaDiferente123"),
    ).toThrow("não coincide");
  });

  it.each([
    [{ missing: true }, "não encontrada"],
    [{ deleted: true }, "excluída"],
    [{ roles: [Role.CUSTOMER] }, "não possui o papel ADMIN"],
    [{ roles: [Role.PROFESSIONAL] }, "não possui o papel ADMIN"],
  ])("rejeita usuário inelegível", async (options, expectedMessage) => {
    const { prisma } = createPrismaMock(options);

    await expect(
      setAdminPassword(prisma, "admin@soravi.com", "SenhaSegura123"),
    ).rejects.toThrow(expectedMessage);
  });

  it("usa argon2id e altera hash, sessões e tokens na mesma transaction", async () => {
    const { prisma, transaction } = createPrismaMock();
    const hashPassword = jest.fn().mockResolvedValue("generated-hash");

    await expect(
      setAdminPassword(
        prisma,
        "admin@soravi.com",
        "SenhaSegura123",
        hashPassword,
      ),
    ).resolves.toBeUndefined();

    expect(hashPassword).toHaveBeenCalledWith("SenhaSegura123", {
      type: argon2id,
    });
    expect(transaction.user.findUnique).toHaveBeenCalledWith({
      where: { emailNormalized: "admin@soravi.com" },
      select: {
        id: true,
        deletedAt: true,
        roles: { select: { role: true } },
      },
    });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: "admin-id" },
      data: { passwordHash: "generated-hash" },
      select: { id: true },
    });
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin-id", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin-id", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    const sessionUpdate = transaction.authSession.updateMany.mock.calls[0][0];
    const tokenUpdate = transaction.passwordResetToken.updateMany.mock.calls[0][0];

    expect(tokenUpdate.data.usedAt).toBe(sessionUpdate.data.revokedAt);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const result = await setAdminPassword(
      createPrismaMock().prisma,
      "admin@soravi.com",
      "SenhaSegura123",
      hashPassword,
    );
    expect(result).toBeUndefined();
  });

  it("rejeita a transaction quando a invalidação dos tokens falha", async () => {
    const { prisma, transaction } = createPrismaMock();
    transaction.passwordResetToken.updateMany.mockRejectedValueOnce(
      new Error("token-hash-secreto"),
    );

    await expect(
      setAdminPassword(
        prisma,
        "admin@soravi.com",
        "SenhaSegura123",
        jest.fn().mockResolvedValue("generated-hash"),
      ),
    ).rejects.toThrow("token-hash-secreto");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).toHaveBeenCalledTimes(1);
    expect(transaction.authSession.updateMany).toHaveBeenCalledTimes(1);
    expect(transaction.passwordResetToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("não retorna nem imprime senha ou hash e desconecta no finally", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = "postgresql://valid-test-url";
    process.env.ADMIN_EMAIL = "admin@soravi.com";
    process.env.DATABASE_URL = databaseUrl;
    const { prisma } = createPrismaMock();
    const log = jest.fn();
    const logError = jest.fn();
    const promptHidden = jest
      .fn()
      .mockResolvedValueOnce("SenhaSegura123")
      .mockResolvedValueOnce("SenhaSegura123");

    try {
      const exitCode = await runSetAdminPasswordCommand({
        createPrisma: () => prisma,
        promptHidden,
        log,
        logError,
      });

      expect(exitCode).toBe(0);
      expect(promptHidden).toHaveBeenNthCalledWith(1, "Nova senha: ");
      expect(promptHidden).toHaveBeenNthCalledWith(
        2,
        "Confirme a nova senha: ",
      );
      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
      const output = [...log.mock.calls, ...logError.mock.calls].flat().join(" ");
      expect(output).not.toContain("SenhaSegura123");
      expect(output).not.toContain("generated-hash");
      expect(output).not.toContain(databaseUrl);
    } finally {
      if (previousEmail === undefined) {
        delete process.env.ADMIN_EMAIL;
      } else {
        process.env.ADMIN_EMAIL = previousEmail;
      }
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("sanitiza falha inesperada, não imprime DATABASE_URL e desconecta", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.ADMIN_EMAIL = "admin@soravi.com";
    process.env.DATABASE_URL = "postgresql://secret-production-url";
    const sensitiveTokenReference = "token-hash-secreto";
    const { prisma } = createPrismaMock();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Error(
        `connection failed: ${process.env.DATABASE_URL}; ${sensitiveTokenReference}`,
      ),
    );
    const logError = jest.fn();

    try {
      const exitCode = await runSetAdminPasswordCommand({
        createPrisma: () => prisma,
        promptHidden: jest.fn().mockResolvedValue("SenhaSegura123"),
        log: jest.fn(),
        logError,
      });

      expect(exitCode).toBe(1);
      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
      expect(logError).toHaveBeenCalledWith(
        "Não foi possível atualizar a senha da conta ADMIN.",
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain(
        process.env.DATABASE_URL,
      );
      expect(JSON.stringify(logError.mock.calls)).not.toContain(
        sensitiveTokenReference,
      );
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
