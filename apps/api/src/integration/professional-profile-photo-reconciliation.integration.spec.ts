import { randomUUID } from "node:crypto";

import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ProfessionalProfilePhotoService } from "../modules/users/professional-profile-photo.service";
import type { StorageService, UploadObjectInput } from "../storage/storage.service";
import { createIntegrationPrismaService } from "./integration-database";
import { deferred } from "./integration-concurrency";

describe("Reconciliação concorrente de foto profissional", () => {
  const controlPrisma = createIntegrationPrismaService();
  const firstPrisma = createIntegrationPrismaService();
  const secondPrisma = createIntegrationPrismaService();
  const createdTaskIds = new Set<string>();
  const pendingOperations = new Set<Promise<unknown>>();

  beforeAll(async () => {
    await Promise.all([controlPrisma.$connect(), firstPrisma.$connect(), secondPrisma.$connect()]);
    const [database] = await controlPrisma.$queryRaw<Array<{ current_database: string }>>(
      Prisma.sql`SELECT current_database()`,
    );
    if (database?.current_database !== "soravi_integration_test") {
      throw new Error("A suíte recusou executar fora do banco de integração.");
    }
    const existingTaskCount = await controlPrisma.professionalProfilePhotoDeletionTask.count();
    if (existingTaskCount > 0) {
      throw new Error("A suíte requer soravi_integration_test sem tarefas de foto preexistentes.");
    }
  });

  afterEach(async () => {
    await Promise.allSettled([...pendingOperations]);
    if (createdTaskIds.size > 0) {
      await controlPrisma.professionalProfilePhotoDeletionTask.deleteMany({
        where: { id: { in: [...createdTaskIds] } },
      });
      createdTaskIds.clear();
    }
  });

  afterAll(async () => {
    await Promise.all([controlPrisma.$disconnect(), firstPrisma.$disconnect(), secondPrisma.$disconnect()]);
  });

  it("não reclama agenda vencida quando o lease ainda é válido", async () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    await createCandidate({
      reconcileNextAt: new Date("2026-10-23T11:00:00.000Z"),
      reconcileLeaseExpiresAt: new Date("2026-10-23T13:00:00.000Z"),
    });
    const deleteObject = jest.fn(async (): Promise<void> => undefined);

    await reconciliationService(controlPrisma, deleteObject).processCandidateReconciliationBatch(now, 1);

    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("reclama agenda vencida sem lease", async () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    const task = await createCandidate({
      reconcileNextAt: new Date("2026-10-23T11:00:00.000Z"),
    });
    const deleteObject = jest.fn(async (): Promise<void> => undefined);

    await reconciliationService(controlPrisma, deleteObject).processCandidateReconciliationBatch(now, 1);

    expect(deleteObject).toHaveBeenCalledWith(task.objectKey);
  });

  it("recupera lease vencido", async () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    const task = await createCandidate({
      reconcileNextAt: new Date("2026-10-23T11:00:00.000Z"),
      reconcileLeaseExpiresAt: new Date("2026-10-23T11:30:00.000Z"),
    });
    const deleteObject = jest.fn(async (): Promise<void> => undefined);

    await reconciliationService(controlPrisma, deleteObject).processCandidateReconciliationBatch(now, 1);

    expect(deleteObject).toHaveBeenCalledWith(task.objectKey);
  });

  it("não permite que segunda execução reclame tarefa enquanto o primeiro delete mantém o lease", async () => {
    const now = new Date("2026-10-23T12:00:00.000Z");
    const task = await createCandidate({
      reconcileNextAt: new Date("2026-10-23T11:00:00.000Z"),
    });
    const deleteStarted = deferred<void>();
    const releaseDelete = deferred<void>();
    const firstDelete = jest.fn(async (): Promise<void> => {
      deleteStarted.resolve();
      await releaseDelete.promise;
    });
    const secondDelete = jest.fn(async (): Promise<void> => undefined);
    const firstService = reconciliationService(firstPrisma, firstDelete);
    const secondService = reconciliationService(secondPrisma, secondDelete);
    let firstRun: Promise<unknown> | undefined;
    let secondRun: Promise<unknown> | undefined;

    try {
      firstRun = track(firstService.processCandidateReconciliationBatch(now, 1));
      await deleteStarted.promise;

      secondRun = track(secondService.processCandidateReconciliationBatch(now, 1));
      await expect(secondRun).resolves.toBeUndefined();

      expect(firstDelete).toHaveBeenCalledWith(task.objectKey);
      expect(secondDelete).not.toHaveBeenCalled();
      const [persistedTask] = await controlPrisma.$queryRaw<
        Array<{ reconcileAttemptCount: number; reconcileLeaseExpiresAt: Date | null }>
      >(Prisma.sql`
        SELECT
          "reconcile_attempt_count" AS "reconcileAttemptCount",
          "reconcile_lease_expires_at" AS "reconcileLeaseExpiresAt"
        FROM "professional_profile_photo_deletion_tasks"
        WHERE "id" = ${task.id}::uuid
      `);
      expect(persistedTask).toMatchObject({ reconcileAttemptCount: 1 });
      expect(persistedTask?.reconcileLeaseExpiresAt).not.toBeNull();
    } finally {
      releaseDelete.resolve();
      await Promise.allSettled([firstRun, secondRun].filter(isDefined));
    }
  });

  async function createCandidate(input: {
    reconcileNextAt: Date;
    reconcileLeaseExpiresAt?: Date;
  }): Promise<{ id: string; objectKey: string }> {
    const id = randomUUID();
    const objectKey = `professional-profile-photos/integration-${randomUUID()}.webp`;
    const createdAt = new Date("2026-10-23T10:00:00.000Z");
    const reconcileClaimedAt = input.reconcileLeaseExpiresAt
      ? new Date(input.reconcileLeaseExpiresAt.getTime() - 60 * 1000)
      : null;
    createdTaskIds.add(id);
    await controlPrisma.$executeRaw(Prisma.sql`
      INSERT INTO "professional_profile_photo_deletion_tasks" (
        "id",
        "object_key",
        "kind",
        "status",
        "attempt_count",
        "next_attempt_at",
        "completed_at",
        "association_deadline_at",
        "reconcile_next_at",
        "reconcile_attempt_count",
        "reconcile_claimed_at",
        "reconcile_lease_expires_at",
        "created_at",
        "updated_at"
      ) VALUES (
        ${id}::uuid,
        ${objectKey},
        ${"UPLOAD_CANDIDATE"}::"ProfessionalProfilePhotoTaskKind",
        ${"COMPLETED"}::"ProfessionalProfilePhotoDeletionStatus",
        1,
        ${createdAt},
        ${createdAt},
        ${createdAt},
        ${input.reconcileNextAt},
        0,
        ${reconcileClaimedAt},
        ${input.reconcileLeaseExpiresAt ?? null},
        ${createdAt},
        ${createdAt}
      )
    `);
    return { id, objectKey };
  }

  function reconciliationService(
    prisma: PrismaService,
    deleteObject: (objectKey: string) => Promise<void>,
  ): ProfessionalProfilePhotoService {
    const storage: StorageService = {
      upload: async (input: UploadObjectInput) => ({ objectKey: input.objectKey ?? "unused" }),
      delete: deleteObject,
      createTemporaryReadUrl: async () => "https://example.test/unused",
    };
    return new ProfessionalProfilePhotoService(prisma, storage);
  }

  function track<T>(operation: Promise<T>): Promise<T> {
    pendingOperations.add(operation);
    operation.finally(() => pendingOperations.delete(operation)).catch(() => undefined);
    return operation;
  }

  function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
  }
});
