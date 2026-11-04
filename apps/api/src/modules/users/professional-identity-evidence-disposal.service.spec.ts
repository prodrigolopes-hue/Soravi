import { Logger } from "@nestjs/common";

import { ProfessionalIdentityEvidenceDisposalService } from "./professional-identity-evidence-disposal.service";

describe("ProfessionalIdentityEvidenceDisposalService task monitoring", () => {
  const prisma = { identityEvidenceDisposalTask: { findMany: jest.fn(), count: jest.fn() } };
  const storage = { delete: jest.fn() };
  const service = new ProfessionalIdentityEvidenceDisposalService(prisma as never, storage as never);

  beforeEach(() => jest.clearAllMocks());

  it("lista tarefas paginadas sem expor referência, objectKey ou erro do storage", async () => {
    const createdAt = new Date("2026-11-03T10:00:00.000Z");
    prisma.identityEvidenceDisposalTask.findMany.mockResolvedValue([{ id: "task", status: "FAILED", attemptCount: 3, policyVersion: "identity-media-v1", eligibleAt: createdAt, nextAttemptAt: createdAt, leaseExpiresAt: null, irreversibleStartedAt: null, completedAt: createdAt, createdAt, updatedAt: createdAt, objectKey: "private/should-not-be-selected", lastError: "storage detail", evidence: { attemptId: "attempt", kind: "DOCUMENT", reference: "private/should-not-be-selected" } }]);
    prisma.identityEvidenceDisposalTask.count.mockResolvedValue(1);

    const result = await service.listTasks(2, 10, "FAILED" as never);

    expect(result).toMatchObject({ items: [{ id: "task", attemptId: "attempt", kind: "DOCUMENT", status: "FAILED", attemptCount: 3, policyVersion: "identity-media-v1" }], pagination: { page: 2, pageSize: 10, total: 1, totalPages: 1 } });
    expect(JSON.stringify(result)).not.toContain("private/should-not-be-selected");
    expect(JSON.stringify(result)).not.toContain("storage detail");
    expect(prisma.identityEvidenceDisposalTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "FAILED" }, skip: 10, take: 10, select: expect.not.objectContaining({ objectKey: expect.anything(), lastError: expect.anything() }) }));
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe("ProfessionalIdentityEvidenceDisposalService sanitized diagnostics", () => {
  const now = new Date("2026-11-04T10:00:00.000Z");
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  function createService(storageError: unknown) {
    const prisma = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const storage = { delete: jest.fn().mockRejectedValue(storageError) };
    const service = new ProfessionalIdentityEvidenceDisposalService(prisma as never, storage as never);
    return { prisma, storage, service };
  }

  async function deleteClaimedEvidence(
    service: ProfessionalIdentityEvidenceDisposalService,
    attemptCount: number,
  ) {
    return (service as unknown as {
      deleteClaimedEvidence: (claim: { id: string; evidenceId: string; attemptId: string; objectKey: string; attemptCount: number; leaseExpiresAt: Date }, at: Date) => Promise<void>;
    }).deleteClaimedEvidence({
      id: "task-correlation-id",
      evidenceId: "evidence-private-id",
      attemptId: "verification-attempt-id",
      objectKey: "private/never-log-this-object-key",
      attemptCount,
      leaseExpiresAt: new Date("2026-11-04T10:05:00.000Z"),
    }, now);
  }

  function sqlText(prisma: { $executeRaw: jest.Mock }): string {
    return (prisma.$executeRaw.mock.calls[0]?.[0] as { strings: readonly string[] }).strings.join("");
  }

  it("registra IDs de correlação e o código interno para falha de storage", async () => {
    const { service } = createService({ $metadata: { httpStatusCode: 503 }, code: "ServiceUnavailable" });

    await deleteClaimedEvidence(service, 1);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining("eventCode=IDENTITY_EVIDENCE_DISPOSAL_STORAGE_DELETE_FAILED"));
    const diagnostic = loggerErrorSpy.mock.calls[0]?.[0] as string;
    expect(diagnostic).toContain("taskId=task-correlation-id");
    expect(diagnostic).toContain("verificationAttemptId=verification-attempt-id");
    expect(diagnostic).toContain("executionAttempt=1");
    expect(diagnostic).toContain("storageHttpStatus=503");
    expect(diagnostic).toContain("storageProviderCode=ServiceUnavailable");
  });

  it("sanitiza erro de storage com dados privados e códigos não permitidos", async () => {
    const privateMessage = "cpf=123.456.789-00 url=https://private.example/private/never-log-this-object-key authorization=secret";
    const { service } = createService({
      $metadata: { httpStatusCode: 418 },
      code: "ARBITRARY_PROVIDER_CODE",
      message: privateMessage,
      stack: privateMessage,
      objectKey: "private/never-log-this-object-key",
      headers: { authorization: "secret" },
    });

    await deleteClaimedEvidence(service, 1);

    const diagnostic = loggerErrorSpy.mock.calls[0]?.[0] as string;
    expect(diagnostic).toContain("storageHttpStatus=UNKNOWN");
    expect(diagnostic).toContain("storageProviderCode=UNKNOWN");
    expect(diagnostic).not.toContain(privateMessage);
    expect(diagnostic).not.toContain("private/never-log-this-object-key");
    expect(diagnostic).not.toContain("authorization");
  });

  it("mantém retry e FAILED ao registrar diagnósticos", async () => {
    loggerErrorSpy.mockImplementation(() => {
      throw new Error("diagnostic sink unavailable");
    });

    const retry = createService(new Error("private failure"));
    await expect(deleteClaimedEvidence(retry.service, 1)).resolves.toBeUndefined();
    expect(retry.prisma.$executeRaw.mock.calls[0]?.[0].values).toContain("PENDING");
    expect(retry.prisma.$executeRaw.mock.calls[0]?.[0].values).toContainEqual(new Date("2026-11-04T10:01:00.000Z"));
    expect(sqlText(retry.prisma)).toContain(`"last_error" = 'STORAGE_DELETE_FAILED'`);

    const terminal = createService(new Error("private failure"));
    await expect(deleteClaimedEvidence(terminal.service, 5)).resolves.toBeUndefined();
    expect(terminal.prisma.$executeRaw.mock.calls[0]?.[0].values).toContain("FAILED");
    expect(sqlText(terminal.prisma)).toContain(`"last_error" = 'STORAGE_DELETE_FAILED'`);

    const claimPrisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: "task-limit-id", evidenceId: "evidence-id", objectKey: "private/object-key", attemptCount: 5 }])
        .mockResolvedValueOnce([{ attemptId: "verification-attempt-id", status: "CLOSED", discardedAt: null, suspended: false }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const limitService = new ProfessionalIdentityEvidenceDisposalService(claimPrisma as never, { delete: jest.fn() } as never);
    const claims = await (limitService as unknown as {
      claimTasks: (tx: typeof claimPrisma, at: Date, limit: number) => Promise<unknown[]>;
    }).claimTasks(claimPrisma, now, 25);
    expect(claims).toEqual([]);
    expect(sqlText(claimPrisma)).toContain("'FAILED'::\"IdentityEvidenceDisposalTaskStatus\"");
    expect(sqlText(claimPrisma)).toContain(`"last_error" = 'ATTEMPT_LIMIT_REACHED'`);
  });
});
