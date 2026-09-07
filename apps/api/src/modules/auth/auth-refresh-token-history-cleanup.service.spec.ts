import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import {
  AUTH_REFRESH_TOKEN_HISTORY_CLEANUP_INTERVAL_MS,
  AuthRefreshTokenHistoryCleanupService,
} from "./auth-refresh-token-history-cleanup.service";

describe("AuthRefreshTokenHistoryCleanupService", () => {
  let service: AuthRefreshTokenHistoryCleanupService;
  let prismaMock: {
    authRefreshTokenHistory: { deleteMany: jest.Mock };
  };
  let schedulerRegistryMock: {
    addInterval: jest.Mock;
    doesExist: jest.Mock;
    deleteInterval: jest.Mock;
  };
  let setIntervalSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-07T12:00:00.000Z"));

    prismaMock = {
      authRefreshTokenHistory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    schedulerRegistryMock = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockReturnValue({} as NodeJS.Timeout);
    loggerLogSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);

    service = createService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("remove somente históricos com expiresAt <= now", async () => {
    prismaMock.authRefreshTokenHistory.deleteMany.mockResolvedValue({
      count: 3,
    });

    await service.cleanupExpiredHistory();

    expect(
      prismaMock.authRefreshTokenHistory.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lte: new Date("2026-09-07T12:00:00.000Z"),
        },
      },
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      "Removidos 3 históricos expirados de refresh token.",
    );
  });

  it("resolve normalmente quando não há registros expirados", async () => {
    prismaMock.authRefreshTokenHistory.deleteMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.cleanupExpiredHistory(),
    ).resolves.toBeUndefined();

    expect(loggerLogSpy).not.toHaveBeenCalled();
  });

  it("resolve sem lançar quando o Prisma falha e libera a trava para a próxima chamada", async () => {
    prismaMock.authRefreshTokenHistory.deleteMany
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      service.cleanupExpiredHistory(),
    ).resolves.toBeUndefined();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha ao limpar histórico expirado de refresh token.",
    );

    await service.cleanupExpiredHistory();

    expect(
      prismaMock.authRefreshTokenHistory.deleteMany,
    ).toHaveBeenCalledTimes(2);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      "Removidos 1 históricos expirados de refresh token.",
    );
  });

  it("ignora execução sobreposta enquanto a primeira limpeza está pendente", async () => {
    let resolveDeleteMany: ((value: { count: number }) => void) | undefined;
    prismaMock.authRefreshTokenHistory.deleteMany
      .mockReturnValueOnce(
        new Promise<{ count: number }>((resolve) => {
          resolveDeleteMany = resolve;
        }),
      )
      .mockResolvedValueOnce({ count: 0 });

    const firstRun = service.cleanupExpiredHistory();
    await service.cleanupExpiredHistory();

    expect(
      prismaMock.authRefreshTokenHistory.deleteMany,
    ).toHaveBeenCalledTimes(1);

    resolveDeleteMany?.({ count: 0 });
    await firstRun;
    await service.cleanupExpiredHistory();

    expect(
      prismaMock.authRefreshTokenHistory.deleteMany,
    ).toHaveBeenCalledTimes(2);
  });

  it("registra o intervalo padrão no SchedulerRegistry e dispara uma limpeza inicial", () => {
    service.onApplicationBootstrap();

    expect(
      prismaMock.authRefreshTokenHistory.deleteMany,
    ).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      AUTH_REFRESH_TOKEN_HISTORY_CLEANUP_INTERVAL_MS,
    );
    expect(schedulerRegistryMock.addInterval).toHaveBeenCalledWith(
      "auth-refresh-token-history-cleanup",
      expect.anything(),
    );
  });

  it("remove o intervalo registrado no shutdown", () => {
    service.onApplicationBootstrap();
    service.onApplicationShutdown();

    expect(schedulerRegistryMock.doesExist).toHaveBeenCalledWith(
      "interval",
      "auth-refresh-token-history-cleanup",
    );
    expect(schedulerRegistryMock.deleteInterval).toHaveBeenCalledWith(
      "auth-refresh-token-history-cleanup",
    );
  });

  it("não remove intervalo inexistente no shutdown", () => {
    schedulerRegistryMock.doesExist.mockReturnValue(false);

    service.onApplicationShutdown();

    expect(schedulerRegistryMock.deleteInterval).not.toHaveBeenCalled();
  });

  function createService(): AuthRefreshTokenHistoryCleanupService {
    return new AuthRefreshTokenHistoryCleanupService(
      prismaMock as unknown as PrismaService,
      schedulerRegistryMock as unknown as SchedulerRegistry,
    );
  }
});
