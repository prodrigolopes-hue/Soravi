import { PreProposalPhotoMaintenanceService } from "./pre-proposal-photo-maintenance.service";

describe("PreProposalPhotoMaintenanceService", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");

  function setup({ referenced = false, deleteFails = false, claimed = true } = {}) {
    const candidate = { id: "candidate-id", objectKey: "pre-proposal-response-photos/key" };
    const claimUpdateMany = jest.fn().mockResolvedValue({ count: claimed ? 1 : 0 });
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({
        $queryRaw: jest.fn().mockResolvedValue([candidate]),
        preProposalResponsePhotoUploadCandidate: { updateMany: claimUpdateMany },
      })),
      preProposalResponsePhotoUploadCandidate: { updateMany: jest.fn().mockResolvedValue({ count: claimed ? 1 : 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      preProposalResponsePhoto: { findUnique: jest.fn().mockResolvedValue(referenced ? { id: "photo-id" } : null) },
    };
    const storage = { delete: jest.fn().mockImplementation(() => deleteFails ? Promise.reject(new Error("storage unavailable")) : Promise.resolve()), upload: jest.fn(), createTemporaryReadUrl: jest.fn() };
    return { prisma, storage, claimUpdateMany, service: new PreProposalPhotoMaintenanceService(prisma as never, storage) };
  }

  it("não exclui objeto já referenciado", async () => {
    const { service, storage, prisma, claimUpdateMany } = setup({ referenced: true });
    await service.processBatch(now);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(prisma.preProposalResponsePhotoUploadCandidate.deleteMany).toHaveBeenCalled();
    expect(claimUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PROCESSING" }) }));
  });

  it("reagenda falha de exclusão", async () => {
    const { service, prisma, claimUpdateMany } = setup({ deleteFails: true });
    await service.processBatch(now);
    expect(prisma.preProposalResponsePhotoUploadCandidate.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastError: "STORAGE_DELETE_FAILED", status: "PENDING" }) }));
    expect(claimUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("mantém candidato após exclusão para capturar upload tardio", async () => {
    const { service, prisma, storage, claimUpdateMany } = setup();
    await service.processBatch(now);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(prisma.preProposalResponsePhotoUploadCandidate.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", nextAttemptAt: new Date(now.getTime() + 86400000) }) }));
    expect(claimUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("não processa candidato já reivindicado por outro processador", async () => {
    const { service, storage, claimUpdateMany } = setup({ claimed: false });
    await service.processBatch(now);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(claimUpdateMany).toHaveBeenCalledTimes(1);
  });
});
