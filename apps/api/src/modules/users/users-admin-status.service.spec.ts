import { PrismaService } from "../../database/prisma.service";
import { UserStatus } from "../../generated/prisma/client";
import { AuthSessionsRevokedNotifier } from "../auth/auth-sessions-revoked.notifier";
import { AdminSelfStatusChangeForbiddenException } from "./errors/admin-self-status-change-forbidden.exception";
import { AdminTargetStatusChangeForbiddenException } from "./errors/admin-target-status-change-forbidden.exception";
import { UserNotFoundException } from "./errors/user-not-found.exception";
import { UserStatusTransitionNotAllowedException } from "./errors/user-status-transition-not-allowed.exception";
import { UsersAdminStatusService } from "./users-admin-status.service";

describe("UsersAdminStatusService.updateStatus", () => {
  const actorUserId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const targetUserId = "725afb87-2b81-4de7-9606-8f382fff3341";
  let service: UsersAdminStatusService;
  let transaction: { $queryRaw: jest.Mock; user: { update: jest.Mock }; authSession: { updateMany: jest.Mock } };
  let prisma: { $transaction: jest.Mock };
  let sessionsRevokedNotifier: { publish: jest.Mock };

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([locked(UserStatus.ACTIVE)]),
      user: { update: jest.fn().mockResolvedValue({}) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma = { $transaction: jest.fn((callback) => callback(transaction)) };
    sessionsRevokedNotifier = { publish: jest.fn() };
    service = new UsersAdminStatusService(
      prisma as unknown as PrismaService,
      sessionsRevokedNotifier as unknown as AuthSessionsRevokedNotifier,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it("executa ACTIVE -> BLOCKED e revoga todas as sessões ativas", async () => {
    await service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED });
    expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: targetUserId }, data: { status: UserStatus.BLOCKED } });
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(sessionsRevokedNotifier.publish).toHaveBeenCalledWith(targetUserId);
    expect(
      transaction.authSession.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(sessionsRevokedNotifier.publish.mock.invocationCallOrder[0]);
  });

  it("executa BLOCKED -> ACTIVE sem restaurar sessões", async () => {
    transaction.$queryRaw.mockResolvedValue([locked(UserStatus.BLOCKED)]);
    await service.updateStatus(actorUserId, targetUserId, { status: UserStatus.ACTIVE });
    expect(transaction.user.update).toHaveBeenCalledWith({ where: { id: targetUserId }, data: { status: UserStatus.ACTIVE } });
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionsRevokedNotifier.publish).not.toHaveBeenCalled();
  });

  it("faz no-op em ACTIVE -> ACTIVE", async () => {
    await service.updateStatus(actorUserId, targetUserId, { status: UserStatus.ACTIVE });
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("em BLOCKED -> BLOCKED só revoga sessões residuais", async () => {
    transaction.$queryRaw.mockResolvedValue([locked(UserStatus.BLOCKED)]);
    await service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED });
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authSession.updateMany).toHaveBeenCalledTimes(1);
    expect(sessionsRevokedNotifier.publish).toHaveBeenCalledWith(targetUserId);
  });

  it("proíbe self-target antes da transação", async () => {
    await expect(service.updateStatus(actorUserId, actorUserId, { status: UserStatus.BLOCKED })).rejects.toBeInstanceOf(AdminSelfStatusChangeForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita outro ADMIN antes de alterar status ou revogar sessões", async () => {
    transaction.$queryRaw.mockResolvedValue([
      locked(UserStatus.ACTIVE, null, true),
    ]);

    await expect(
      service.updateStatus(actorUserId, targetUserId, {
        status: UserStatus.BLOCKED,
      }),
    ).rejects.toBeInstanceOf(AdminTargetStatusChangeForbiddenException);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
  });

  it.each(["CUSTOMER", "PROFESSIONAL"])(
    "permite alterar conta %s",
    async () => {
      await expect(
        service.updateStatus(actorUserId, targetUserId, {
          status: UserStatus.BLOCKED,
        }),
      ).resolves.toBeUndefined();
      expect(transaction.user.update).toHaveBeenCalledTimes(1);
      expect(transaction.authSession.updateMany).toHaveBeenCalledTimes(1);
    },
  );

  it.each([UserStatus.PENDING, UserStatus.SUSPENDED, UserStatus.DEACTIVATED])(
    "rejeita status solicitado %s na camada de negócio",
    async (status) => {
      await expect(
        service.updateStatus(actorUserId, targetUserId, { status } as never),
      ).rejects.toBeInstanceOf(UserStatusTransitionNotAllowedException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(transaction.user.update).not.toHaveBeenCalled();
      expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([["inexistente", []], ["soft-deleted", [locked(UserStatus.ACTIVE, new Date())]]])("rejeita usuário %s", async (_label, rows) => {
    transaction.$queryRaw.mockResolvedValue(rows);
    await expect(service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED })).rejects.toBeInstanceOf(UserNotFoundException);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
  });

  it.each([UserStatus.PENDING, UserStatus.SUSPENDED, UserStatus.DEACTIVATED])("rejeita transição a partir de %s", async (status) => {
    transaction.$queryRaw.mockResolvedValue([locked(status)]);
    await expect(service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED })).rejects.toBeInstanceOf(UserStatusTransitionNotAllowedException);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("não revoga sessões se user.update falhar", async () => {
    transaction.user.update.mockRejectedValue(new Error("update failed"));
    await expect(service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED })).rejects.toThrow("update failed");
    expect(transaction.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionsRevokedNotifier.publish).not.toHaveBeenCalled();
  });

  it("rejeita a transação se a revogação falhar", async () => {
    transaction.authSession.updateMany.mockRejectedValue(new Error("revoke failed"));
    await expect(service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED })).rejects.toThrow("revoke failed");
    expect(sessionsRevokedNotifier.publish).not.toHaveBeenCalled();
  });

  it("faz SELECT FOR UPDATE antes dos efeitos", async () => {
    await service.updateStatus(actorUserId, targetUserId, { status: UserStatus.BLOCKED });
    const query = transaction.$queryRaw.mock.calls[0][0] as { strings: readonly string[]; values: unknown[] };
    expect(query.strings.join(" ")).toContain("FOR UPDATE");
    expect(query.strings.join(" ")).toContain('"deleted_at" AS "deletedAt"');
    expect(query.strings.join(" ")).toContain('FROM "user_roles"');
    expect(query.values).toContain("ADMIN");
    expect(query.values).toContain(targetUserId);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.user.update.mock.invocationCallOrder[0]);
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(transaction.authSession.updateMany.mock.invocationCallOrder[0]);
  });

  it("publica revogacao somente depois da transacao concluir", async () => {
    let signalTransactionReached!: () => void;
    let releaseTransaction!: () => void;

    const transactionReached = new Promise<void>((resolve) => {
      signalTransactionReached = resolve;
    });

    const transactionRelease = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });

    prisma.$transaction.mockImplementation(
      async (callback) => {
        await callback(transaction);

        signalTransactionReached();
        await transactionRelease;
      },
    );

    const updateStatusPromise = service.updateStatus(
      actorUserId,
      targetUserId,
      {
        status: UserStatus.BLOCKED,
      },
    );

    await transactionReached;

    expect(
      transaction.authSession.updateMany,
    ).toHaveBeenCalledTimes(1);

    expect(
      sessionsRevokedNotifier.publish,
    ).not.toHaveBeenCalled();

    releaseTransaction();

    await updateStatusPromise;

    expect(
      sessionsRevokedNotifier.publish,
    ).toHaveBeenCalledWith(targetUserId);
  });

  function locked(
    status: UserStatus,
    deletedAt: Date | null = null,
    isAdmin = false,
  ) {
    return { id: targetUserId, status, deletedAt, isAdmin };
  }
});
