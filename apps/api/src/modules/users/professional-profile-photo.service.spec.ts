import { PrismaService } from "../../database/prisma.service";
import { ProfessionalProfilePhotoDeletionStatus } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import * as imageProcessor from "./professional-profile-photo-image";
import { ProfessionalProfilePhotoCandidateUnavailableException } from "./errors/professional-profile-photo-candidate-unavailable.exception";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";

describe("ProfessionalProfilePhotoService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const profileId = "725afb87-2b81-4de7-9606-8f382fff3341";
  let service: ProfessionalProfilePhotoService;
  let prisma: {
    professionalProfile: { findFirst: jest.Mock };
    professionalProfilePhotoDeletionTask: { create: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let transaction: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    professionalProfile: { findFirst: jest.Mock };
    professionalProfilePhoto: { findUnique: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
    professionalProfilePhotoDeletionTask: { create: jest.Mock; delete: jest.Mock; update: jest.Mock };
  };
  let storage: { upload: jest.Mock; delete: jest.Mock };

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: "candidate-task",
          kind: "UPLOAD_CANDIDATE",
          status: ProfessionalProfilePhotoDeletionStatus.PENDING,
          attemptCount: 0,
          associationDeadlineAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      professionalProfile: { findFirst: jest.fn().mockResolvedValue({ id: profileId }) },
      professionalProfilePhoto: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      professionalProfilePhotoDeletionTask: {
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      professionalProfile: { findFirst: jest.fn().mockResolvedValue({ id: profileId }) },
      professionalProfilePhotoDeletionTask: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    storage = {
      upload: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(imageProcessor, "processProfessionalProfilePhoto").mockResolvedValue({
      buffer: Buffer.from("processed"),
      mimeType: "image/webp",
      width: 512,
      height: 512,
      sizeBytes: 9,
    });
    service = new ProfessionalProfilePhotoService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("vincula somente o perfil do userId autenticado e usa chave opaca exclusiva", async () => {
    const result = await service.replaceCurrent(userId, {
      buffer: Buffer.from("input"),
      declaredMimeType: "image/jpeg",
    });

    expect(prisma.professionalProfile.findFirst).toHaveBeenCalledWith({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: { id: true },
    });
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({
      objectKey: expect.stringMatching(/^professional-profile-photos\/[0-9a-f-]+\.webp$/u),
      contentType: "image/webp",
    }));
    expect(transaction.professionalProfile.findFirst).toHaveBeenCalledWith({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      select: { id: true },
    });
    expect(transaction.professionalProfilePhoto.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { professionalProfileId: profileId },
    }));
    expect(result.objectKey).toMatch(/^professional-profile-photos\/[0-9a-f-]+\.webp$/u);
  });

  it("registra o candidato antes do upload e o preserva quando o upload falha", async () => {
    storage.upload.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      service.replaceCurrent(userId, { buffer: Buffer.from("input") }),
    ).rejects.toThrow("storage unavailable");

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("substitui a referência e registra a limpeza da foto anterior na mesma transação", async () => {
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue({
      objectKey: "professional-profile-photos/old.webp",
    });

    await service.replaceCurrent(userId, { buffer: Buffer.from("input") });

    expect(transaction.professionalProfilePhoto.upsert).toHaveBeenCalledTimes(1);
    expect(transaction.professionalProfilePhotoDeletionTask.delete).toHaveBeenCalledWith({
      where: { id: "candidate-task" },
    });
    expect(transaction.professionalProfilePhotoDeletionTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        objectKey: "professional-profile-photos/old.webp",
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
      }),
    });
  });

  it("recusa associação se a limpeza já reclamou o candidato", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        kind: "UPLOAD_CANDIDATE",
        status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
        attemptCount: 0,
        associationDeadlineAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    await expect(
      service.replaceCurrent(userId, { buffer: Buffer.from("input") }),
    ).rejects.toBeInstanceOf(ProfessionalProfilePhotoCandidateUnavailableException);
    expect(transaction.professionalProfilePhoto.upsert).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhotoDeletionTask.update).not.toHaveBeenCalled();
  });

  it("reconcilia o objeto que termina de enviar depois da limpeza e antes da associação", async () => {
    let signalUploadStarted: (input: Parameters<StorageService["upload"]>[0]) => void = () => undefined;
    const uploadStarted = new Promise<Parameters<StorageService["upload"]>[0]>((resolve) => {
      signalUploadStarted = resolve;
    });
    let releaseUpload: () => void = () => undefined;
    const uploadCanFinish = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    storage.upload.mockImplementation(async (input: Parameters<StorageService["upload"]>[0]) => {
      signalUploadStarted(input);
      await uploadCanFinish;
    });

    let replacement: Promise<unknown> | undefined;
    try {
      replacement = service.replaceCurrent(userId, { buffer: Buffer.from("input") });
      const { objectKey } = await uploadStarted;

      transaction.$queryRaw
        .mockResolvedValueOnce([
          {
            id: "candidate-task",
            objectKey,
            attemptCount: 0,
            status: ProfessionalProfilePhotoDeletionStatus.PENDING,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "candidate-task",
            kind: "UPLOAD_CANDIDATE",
            status: ProfessionalProfilePhotoDeletionStatus.COMPLETED,
            attemptCount: 1,
            associationDeadlineAt: new Date("2026-10-22T13:00:00.000Z"),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "candidate-task",
            objectKey,
            reconcileAttemptCount: 0,
          },
        ]);
      transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);

      await service.processCleanupBatch(new Date("2026-10-22T12:00:00.000Z"), 1);
      releaseUpload();

      await expect(replacement).rejects.toBeInstanceOf(ProfessionalProfilePhotoCandidateUnavailableException);
      await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:05:00.000Z"), 1);

      expect(transaction.professionalProfilePhoto.upsert).not.toHaveBeenCalled();
      expect(storage.delete).toHaveBeenNthCalledWith(1, objectKey);
      expect(storage.delete).toHaveBeenNthCalledWith(2, objectKey);
      expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    } finally {
      releaseUpload();
      await replacement?.catch(() => undefined);
    }
  });

  it("não reconcilia candidato associado e não disputa a associação PENDING", async () => {
    transaction.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "candidate-task",
          kind: "UPLOAD_CANDIDATE",
          status: ProfessionalProfilePhotoDeletionStatus.PENDING,
          attemptCount: 0,
          associationDeadlineAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ]);

    await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:00:00.000Z"), 1);
    await service.replaceCurrent(userId, { buffer: Buffer.from("input") });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhoto.upsert).toHaveBeenCalledTimes(1);
    expect(transaction.professionalProfilePhotoDeletionTask.delete).toHaveBeenCalledWith({
      where: { id: "candidate-task" },
    });
  });

  it("rejeita candidato PENDING após sua janela imutável de associação", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        kind: "UPLOAD_CANDIDATE",
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
        attemptCount: 0,
        associationDeadlineAt: new Date(0),
        nextAttemptAt: new Date("2099-01-01T00:00:00.000Z"),
      },
    ]);

    await expect(
      service.replaceCurrent(userId, { buffer: Buffer.from("input") }),
    ).rejects.toBeInstanceOf(ProfessionalProfilePhotoCandidateUnavailableException);
    expect(transaction.professionalProfilePhoto.upsert).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhotoDeletionTask.update).not.toHaveBeenCalled();
  });

  it("recusa associação depois de falha de exclusão que retorna a tarefa para PENDING", async () => {
    transaction.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "cleanup-task",
          objectKey: "professional-profile-photos/candidate.webp",
          attemptCount: 0,
          status: ProfessionalProfilePhotoDeletionStatus.PENDING,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "candidate-task",
          kind: "UPLOAD_CANDIDATE",
          status: ProfessionalProfilePhotoDeletionStatus.PENDING,
          attemptCount: 1,
          associationDeadlineAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);
    storage.delete.mockRejectedValue(new Error("storage unavailable"));

    await service.processCleanupBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    await expect(
      service.replaceCurrent(userId, { buffer: Buffer.from("input") }),
    ).rejects.toBeInstanceOf(ProfessionalProfilePhotoCandidateUnavailableException);

    expect(prisma.professionalProfilePhotoDeletionTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
        lastError: "STORAGE_DELETE_FAILED",
      }),
    }));
    expect(transaction.professionalProfilePhoto.upsert).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhotoDeletionTask.delete).not.toHaveBeenCalled();
  });

  it("remove a associação e agenda limpeza; repetição é inofensiva", async () => {
    transaction.professionalProfilePhoto.findUnique
      .mockResolvedValueOnce({ objectKey: "professional-profile-photos/current.webp" })
      .mockResolvedValueOnce(null);

    await service.removeCurrent(userId);
    await service.removeCurrent(userId);

    expect(transaction.professionalProfilePhoto.delete).toHaveBeenCalledTimes(1);
    expect(transaction.professionalProfilePhotoDeletionTask.create).toHaveBeenCalledTimes(1);
  });

  it("recupera candidato abandonado com lease expirado e conclui a limpeza", async () => {
    const now = new Date("2026-10-22T12:00:00.000Z");
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        objectKey: "professional-profile-photos/abandoned.webp",
        attemptCount: 1,
        status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);

    await service.processCleanupBatch(now, 1);

    expect(transaction.$queryRaw).toHaveBeenCalledWith(expect.objectContaining({ strings: expect.arrayContaining([expect.stringContaining("FOR UPDATE SKIP LOCKED")]) }));
    expect(transaction.professionalProfilePhotoDeletionTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ProfessionalProfilePhotoDeletionStatus.PROCESSING }),
    }));
    expect(storage.delete).toHaveBeenCalledWith("professional-profile-photos/abandoned.webp");
    expect(prisma.professionalProfilePhotoDeletionTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ProfessionalProfilePhotoDeletionStatus.COMPLETED }),
    }));
  });

  it("não exclui objeto ainda referenciado", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "cleanup-task",
        objectKey: "professional-profile-photos/referenced.webp",
        attemptCount: 0,
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue({ professionalProfileId: profileId });

    await service.processCleanupBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(storage.delete).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhotoDeletionTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProfessionalProfilePhotoDeletionStatus.FAILED,
        lastError: "OBJECT_STILL_REFERENCED",
      }),
    }));
  });

  it("não exclui candidato em reconciliação que esteja associado", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        objectKey: "professional-profile-photos/referenced-candidate.webp",
        reconcileAttemptCount: 2,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue({ professionalProfileId: profileId });

    await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(storage.delete).not.toHaveBeenCalled();
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("não reclama agenda vencida enquanto o lease de reconciliação permanece válido", async () => {
    transaction.$queryRaw.mockResolvedValue([]);

    await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(storage.delete).not.toHaveBeenCalled();
    expect(transaction.$queryRaw).toHaveBeenCalledWith(expect.objectContaining({
      strings: expect.arrayContaining([
        expect.stringContaining('"reconcile_lease_expires_at" IS NULL'),
      ]),
    }));
  });

  it("reclama agenda vencida sem lease de reconciliação", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        objectKey: "professional-profile-photos/reconcile-ready.webp",
        reconcileAttemptCount: 0,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);

    await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(storage.delete).toHaveBeenCalledWith("professional-profile-photos/reconcile-ready.webp");
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("recupera lease de reconciliação vencido", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "candidate-task",
        objectKey: "professional-profile-photos/reconcile-expired-lease.webp",
        reconcileAttemptCount: 2,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);

    await service.processCandidateReconciliationBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(storage.delete).toHaveBeenCalledWith("professional-profile-photos/reconcile-expired-lease.webp");
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("limita retentativas e persiste apenas código sanitizado de falha", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "cleanup-task",
        objectKey: "professional-profile-photos/retry.webp",
        attemptCount: 4,
        status: ProfessionalProfilePhotoDeletionStatus.PENDING,
      },
    ]);
    transaction.professionalProfilePhoto.findUnique.mockResolvedValue(null);
    storage.delete.mockRejectedValue(new Error("https://signed.example/token secret"));

    await service.processCleanupBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(prisma.professionalProfilePhotoDeletionTask.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProfessionalProfilePhotoDeletionStatus.FAILED,
        lastError: "STORAGE_DELETE_FAILED",
      }),
    }));
  });

  it("finaliza recuperação de lease vencido no limite sem excluir novamente", async () => {
    transaction.$queryRaw.mockResolvedValue([
      {
        id: "expired-lease-task",
        objectKey: "professional-profile-photos/lease.webp",
        attemptCount: 5,
        status: ProfessionalProfilePhotoDeletionStatus.PROCESSING,
      },
    ]);

    await service.processCleanupBatch(new Date("2026-10-22T12:00:00.000Z"), 1);

    expect(transaction.professionalProfilePhoto.findUnique).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(transaction.professionalProfilePhotoDeletionTask.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: ProfessionalProfilePhotoDeletionStatus.FAILED,
        lastError: "CLEANUP_ATTEMPT_LIMIT_REACHED",
      }),
    }));
  });
});
