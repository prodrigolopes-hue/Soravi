import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { PrismaService } from "../../database/prisma.service";
import { ServiceRequestStatus } from "../../generated/prisma/client";
import {
  OPPORTUNITY_DISTRIBUTION_BATCH_SIZE_DEFAULT,
  OPPORTUNITY_DISTRIBUTION_INTERVAL_MS_DEFAULT,
  ServiceOpportunityDistributionProcessor,
} from "./service-opportunity-distribution.processor";
import { ServiceOpportunityDistributionService } from "./service-opportunity-distribution.service";

describe("ServiceOpportunityDistributionProcessor", () => {
  let processor: ServiceOpportunityDistributionProcessor;
  let prismaMock: {
    serviceRequest: { findMany: jest.Mock };
  };
  let distributionServiceMock: {
    distribute: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let schedulerRegistryMock: {
    addInterval: jest.Mock;
    doesExist: jest.Mock;
    deleteInterval: jest.Mock;
  };
  let setIntervalSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    prismaMock = {
      serviceRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    distributionServiceMock = {
      distribute: jest.fn().mockResolvedValue({
        dispatched: true,
        opportunitiesCreated: 1,
      }),
    };
    configServiceMock = {
      get: jest.fn((_key: string, defaultValue: number) => defaultValue),
    };
    schedulerRegistryMock = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(true),
      deleteInterval: jest.fn(),
    };
    setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockReturnValue({} as NodeJS.Timeout);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    processor = createProcessor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("busca somente solicitações elegíveis, ordenadas e dentro do batch", async () => {
    const beforeQuery = Date.now();

    await processor.processEligibleServiceRequests();
    const afterQuery = Date.now();

    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledWith({
      where: {
        status: ServiceRequestStatus.OPEN,
        editableUntil: { lte: expect.any(Date) },
        opportunitiesDispatchedAt: null,
        deletedAt: null,
      },
      orderBy: { editableUntil: "asc" },
      take: OPPORTUNITY_DISTRIBUTION_BATCH_SIZE_DEFAULT,
      select: { id: true },
    });
    const queryDate = prismaMock.serviceRequest.findMany.mock.calls[0]?.[0]
      .where.editableUntil.lte as Date;
    expect(queryDate.getTime()).toBeGreaterThanOrEqual(beforeQuery);
    expect(queryDate.getTime()).toBeLessThanOrEqual(afterQuery);
  });

  it("chama distribute para cada ID elegível", async () => {
    prismaMock.serviceRequest.findMany.mockResolvedValue([
      { id: "request-1" },
      { id: "request-2" },
    ]);

    await processor.processEligibleServiceRequests();

    expect(distributionServiceMock.distribute).toHaveBeenNthCalledWith(
      1,
      "request-1",
    );
    expect(distributionServiceMock.distribute).toHaveBeenNthCalledWith(
      2,
      "request-2",
    );
  });

  it("continua o lote após falha individual e registra o erro", async () => {
    prismaMock.serviceRequest.findMany.mockResolvedValue([
      { id: "request-1" },
      { id: "request-2" },
    ]);
    distributionServiceMock.distribute
      .mockRejectedValueOnce(new Error("distribution failed"))
      .mockResolvedValueOnce({ dispatched: true, opportunitiesCreated: 1 });

    await processor.processEligibleServiceRequests();

    expect(distributionServiceMock.distribute).toHaveBeenCalledTimes(2);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha ao distribuir oportunidades para a solicitação request-1.",
      expect.any(String),
    );
  });

  it("ignora execução sobreposta", async () => {
    let resolveQuery: ((value: Array<{ id: string }>) => void) | undefined;
    prismaMock.serviceRequest.findMany.mockReturnValue(
      new Promise<Array<{ id: string }>>((resolve) => {
        resolveQuery = resolve;
      }),
    );

    const firstExecution = processor.processEligibleServiceRequests();
    await processor.processEligibleServiceRequests();

    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledTimes(1);
    resolveQuery?.([]);
    await firstExecution;
  });

  it("finaliza normalmente quando o lote está vazio", async () => {
    await expect(
      processor.processEligibleServiceRequests(),
    ).resolves.toBeUndefined();

    expect(distributionServiceMock.distribute).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("registra erro global de consulta e libera a próxima execução", async () => {
    prismaMock.serviceRequest.findMany
      .mockRejectedValueOnce(new Error("query failed"))
      .mockResolvedValueOnce([]);

    await processor.processEligibleServiceRequests();
    await processor.processEligibleServiceRequests();

    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledTimes(2);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha ao buscar solicitações elegíveis para distribuição.",
      expect.any(String),
    );
  });

  it("registra o intervalo padrão no SchedulerRegistry", () => {
    processor.onApplicationBootstrap();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      OPPORTUNITY_DISTRIBUTION_INTERVAL_MS_DEFAULT,
    );
    expect(schedulerRegistryMock.addInterval).toHaveBeenCalledWith(
      "service-opportunity-distribution",
      expect.anything(),
    );
  });

  it("usa intervalo e batch configurados", async () => {
    configServiceMock.get.mockImplementation(
      (key: string, defaultValue: number) =>
        ({
          OPPORTUNITY_DISTRIBUTION_INTERVAL_MS: 5_000,
          OPPORTUNITY_DISTRIBUTION_BATCH_SIZE: 12,
        })[key] ?? defaultValue,
    );
    processor = createProcessor();

    processor.onApplicationBootstrap();
    await processor.processEligibleServiceRequests();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);
    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 12 }),
    );
  });

  it("remove o intervalo registrado no encerramento", () => {
    processor.onApplicationShutdown();

    expect(schedulerRegistryMock.doesExist).toHaveBeenCalledWith(
      "interval",
      "service-opportunity-distribution",
    );
    expect(schedulerRegistryMock.deleteInterval).toHaveBeenCalledWith(
      "service-opportunity-distribution",
    );
  });

  function createProcessor(): ServiceOpportunityDistributionProcessor {
    return new ServiceOpportunityDistributionProcessor(
      prismaMock as unknown as PrismaService,
      distributionServiceMock as unknown as ServiceOpportunityDistributionService,
      configServiceMock as unknown as ConfigService,
      schedulerRegistryMock as unknown as SchedulerRegistry,
    );
  }
});
