import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import {
  PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE,
  PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_INTERVAL_MS,
  ProfessionalProfilePhotoProcessor,
} from "./professional-profile-photo.processor";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";

describe("ProfessionalProfilePhotoProcessor", () => {
  let processor: ProfessionalProfilePhotoProcessor;
  let photoServiceMock: {
    processCleanupBatch: jest.Mock;
    processCandidateReconciliationBatch: jest.Mock;
  };
  let schedulerRegistryMock: {
    addInterval: jest.Mock;
    doesExist: jest.Mock;
    deleteInterval: jest.Mock;
  };
  let setIntervalSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    photoServiceMock = {
      processCleanupBatch: jest.fn().mockResolvedValue(undefined),
      processCandidateReconciliationBatch: jest.fn().mockResolvedValue(undefined),
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
    processor = new ProfessionalProfilePhotoProcessor(
      photoServiceMock as unknown as ProfessionalProfilePhotoService,
      schedulerRegistryMock as unknown as SchedulerRegistry,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("processa limpeza e reconciliação com lote limitado", async () => {
    await processor.processBatches();

    expect(photoServiceMock.processCleanupBatch).toHaveBeenCalledWith(
      expect.any(Date),
      PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE,
    );
    expect(
      photoServiceMock.processCandidateReconciliationBatch,
    ).toHaveBeenCalledWith(
      expect.any(Date),
      PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_BATCH_SIZE,
    );
  });

  it("impede execução sobreposta e libera a proteção ao concluir", async () => {
    let resolveCleanup: (() => void) | undefined;
    photoServiceMock.processCleanupBatch.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveCleanup = resolve;
      }),
    );

    const firstRun = processor.processBatches();
    await processor.processBatches();
    expect(photoServiceMock.processCleanupBatch).toHaveBeenCalledTimes(1);

    resolveCleanup?.();
    await firstRun;
    await processor.processBatches();
    expect(photoServiceMock.processCleanupBatch).toHaveBeenCalledTimes(2);
  });

  it("continua a reconciliação quando a limpeza falha", async () => {
    photoServiceMock.processCleanupBatch.mockRejectedValueOnce(
      new Error("storage failure"),
    );

    await processor.processBatches();

    expect(
      photoServiceMock.processCandidateReconciliationBatch,
    ).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha sanitizada no processamento de limpeza de fotos profissionais.",
    );
  });

  it("permite execução posterior após falha", async () => {
    photoServiceMock.processCandidateReconciliationBatch.mockRejectedValueOnce(
      new Error("storage failure"),
    );

    await processor.processBatches();
    await processor.processBatches();

    expect(photoServiceMock.processCleanupBatch).toHaveBeenCalledTimes(2);
    expect(
      photoServiceMock.processCandidateReconciliationBatch,
    ).toHaveBeenCalledTimes(2);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Falha sanitizada na reconciliação de fotos profissionais.",
    );
  });

  it("registra o intervalo e o remove no encerramento", () => {
    processor.onApplicationBootstrap();

    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      PROFESSIONAL_PROFILE_PHOTO_PROCESSOR_INTERVAL_MS,
    );
    expect(schedulerRegistryMock.addInterval).toHaveBeenCalledWith(
      "professional-profile-photo-maintenance",
      expect.anything(),
    );

    processor.onApplicationShutdown();
    expect(schedulerRegistryMock.doesExist).toHaveBeenCalledWith(
      "interval",
      "professional-profile-photo-maintenance",
    );
    expect(schedulerRegistryMock.deleteInterval).toHaveBeenCalledWith(
      "professional-profile-photo-maintenance",
    );
  });
});
