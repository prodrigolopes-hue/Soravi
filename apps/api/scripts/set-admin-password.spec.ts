import { argon2id } from "argon2";

import { Role } from "../src/generated/prisma/client";
import {
  AdminPasswordOperationError,
  type AdminPasswordPrismaClient,
  normalizeAdminEmail,
  runSetAdminPasswordCommand,
  setAdminPassword,
  validateAdminPassword,
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

  it.each([
    ["Curta123", "pelo menos 12"],
    [`A1${"x".repeat(127)}`, "no máximo 128"],
    ["123456789012", "pelo menos uma letra"],
    ["abcdefghijkl", "pelo menos um número"],
  ])("rejeita senha fora da política", (password, expectedMessage) => {
    expect(() => validateAdminPassword(password)).toThrow(expectedMessage);
  });

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

  it("usa argon2id, altera somente passwordHash e revoga sessões na mesma transaction", async () => {
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
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const result = await setAdminPassword(
      createPrismaMock().prisma,
      "admin@soravi.com",
      "SenhaSegura123",
      hashPassword,
    );
    expect(result).toBeUndefined();
  });

  it("não retorna nem imprime senha ou hash e desconecta no finally", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "admin@soravi.com";
    const { prisma } = createPrismaMock();
    const log = jest.fn();
    const logError = jest.fn();

    try {
      const exitCode = await runSetAdminPasswordCommand({
        createPrisma: () => prisma,
        promptHidden: jest
          .fn()
          .mockResolvedValueOnce("SenhaSegura123")
          .mockResolvedValueOnce("SenhaSegura123"),
        log,
        logError,
      });

      expect(exitCode).toBe(0);
      expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
      const output = [...log.mock.calls, ...logError.mock.calls].flat().join(" ");
      expect(output).not.toContain("SenhaSegura123");
      expect(output).not.toContain("generated-hash");
    } finally {
      if (previousEmail === undefined) {
        delete process.env.ADMIN_EMAIL;
      } else {
        process.env.ADMIN_EMAIL = previousEmail;
      }
    }
  });

  it("sanitiza falha inesperada, não imprime DATABASE_URL e desconecta", async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.ADMIN_EMAIL = "admin@soravi.com";
    process.env.DATABASE_URL = "postgresql://secret-production-url";
    const { prisma } = createPrismaMock();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      new Error(`connection failed: ${process.env.DATABASE_URL}`),
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
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
