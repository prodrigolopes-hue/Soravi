import { Role, UserStatus } from "../src/generated/prisma/client";
import {
  activateInitialAdmin,
  InitialAdminActivationError,
  type InitialAdminActivationPrismaClient,
  validateActivationConfirmation,
  validateActivationEnvironment,
  validateLocalDatabaseUrl,
} from "./activate-initial-admin";

const userId = "8cf4f2a4-7e90-4d71-94af-5f6d01f53e11";
const executionId = "a44d6df4-7930-43d6-91ad-d9b4b3c97394";
const input = {
  emailNormalized: "fundador@soravi.local",
  userId,
  justification: "Ativação excepcional da conta fundadora local.",
  executionId,
};

function createPrismaMock(user: {
  id: string;
  deletedAt: Date | null;
  status: UserStatus;
  roles: Array<{ role: Role }>;
} | null) {
  let rolledBack = false;
  const transaction = {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    adminActivationAudit: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "audit-id" }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (operation) => {
      try {
        return await operation(transaction);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    }),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  } as unknown as InitialAdminActivationPrismaClient;

  return {
    prisma,
    transaction,
    wasRolledBack: () => rolledBack,
  };
}

describe("activateInitialAdmin", () => {
  it("ativa uma conta ADMIN PENDING e registra a auditoria na transação", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.PENDING,
      roles: [{ role: Role.ADMIN }, { role: Role.CUSTOMER }],
    });

    await activateInitialAdmin(prisma, input);

    expect(transaction.user.findFirst).toHaveBeenCalledWith({
      where: { id: userId, emailNormalized: input.emailNormalized },
      select: {
        id: true,
        deletedAt: true,
        status: true,
        roles: { select: { role: true } },
      },
    });
    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: userId, status: UserStatus.PENDING },
      data: { status: UserStatus.ACTIVE },
    });
    expect(transaction.adminActivationAudit.create).toHaveBeenCalledWith({
      data: {
        userId,
        action: "INITIAL_ADMIN_ACTIVATED",
        previousStatus: UserStatus.PENDING,
        newStatus: UserStatus.ACTIVE,
        justification: input.justification,
        executionId,
      },
      select: { id: true },
    });
  });

  it("recusa usuário inexistente ou com ID que não confirma o e-mail", async () => {
    const { prisma, transaction } = createPrismaMock(null);

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "Conta ADMIN inicial não encontrada",
    );
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("recusa conta sem papel ADMIN", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.PENDING,
      roles: [{ role: Role.CUSTOMER }],
    });

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "não possui o papel ADMIN",
    );
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("recusa conta excluída", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: new Date(),
      status: UserStatus.PENDING,
      roles: [{ role: Role.ADMIN }],
    });

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "está excluída",
    );
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("recusa conta que já não está PENDING", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.ACTIVE,
      roles: [{ role: Role.ADMIN }],
    });

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "deve estar com status PENDING",
    );
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("recusa uma segunda ativação que já possui auditoria", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.PENDING,
      roles: [{ role: Role.ADMIN }],
    });
    transaction.adminActivationAudit.findUnique.mockResolvedValueOnce({
      id: "existing-audit-id",
    });

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "já possui registro de ativação",
    );
    expect(transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("recusa confirmação explícita incorreta", () => {
    expect(() => validateActivationConfirmation("ACTIVE")).toThrow(
      InitialAdminActivationError,
    );
  });

  it.each(["production", "staging"])(
    "recusa execução em %s",
    (environment) => {
      expect(() => validateActivationEnvironment(environment)).toThrow(
        "não pode ser executada",
      );
    },
  );

  it("recusa banco que não seja o local explicitamente confirmado", () => {
    expect(() =>
      validateLocalDatabaseUrl(
        "postgresql://user:password@db.example.com:5432/soravi",
        "soravi",
      ),
    ).toThrow("banco local explicitamente confirmado");
  });

  it("propaga falha da auditoria para que a transação seja revertida", async () => {
    const { prisma, transaction, wasRolledBack } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.PENDING,
      roles: [{ role: Role.ADMIN }],
    });
    transaction.adminActivationAudit.create.mockRejectedValueOnce(
      new Error("audit insert failed"),
    );

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "audit insert failed",
    );
    expect(transaction.user.updateMany).toHaveBeenCalledTimes(1);
    expect(wasRolledBack()).toBe(true);
  });

  it("falha quando a atualização condicional não atualiza exatamente um registro", async () => {
    const { prisma, transaction } = createPrismaMock({
      id: userId,
      deletedAt: null,
      status: UserStatus.PENDING,
      roles: [{ role: Role.ADMIN }],
    });
    transaction.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(activateInitialAdmin(prisma, input)).rejects.toThrow(
      "não estava mais PENDING",
    );
    expect(transaction.adminActivationAudit.create).not.toHaveBeenCalled();
  });
});
