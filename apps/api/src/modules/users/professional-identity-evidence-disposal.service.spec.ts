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
