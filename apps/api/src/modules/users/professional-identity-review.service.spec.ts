import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProfessionalIdentityReviewService } from "./professional-identity-review.service";

describe("ProfessionalIdentityReviewService", () => {
  const tx = { $queryRaw: jest.fn(), identityVerificationDecision: { create: jest.fn() }, professionalIdentityVerificationAttempt: { update: jest.fn() } };
  const prisma = { professionalIdentityVerificationAttempt: { findMany: jest.fn() }, identityVerificationEvidenceReference: { findFirst: jest.fn() }, $transaction: jest.fn((fn) => fn(tx)) };
  const storage = { createTemporaryReadUrl: jest.fn().mockResolvedValue("https://private.example/temporary") };
  const service = new ProfessionalIdentityReviewService(prisma as never, storage as never);
  beforeEach(() => jest.clearAllMocks());
  it("emite somente URL temporária para evidência UNDER_REVIEW", async () => {
    prisma.identityVerificationEvidenceReference.findFirst.mockResolvedValue({ reference: "private/key" });
    await expect(service.evidence("attempt")).resolves.toEqual({ url: "https://private.example/temporary", expiresInSeconds: 60 });
    expect(storage.createTemporaryReadUrl).toHaveBeenCalledWith("private/key", 60);
  });
  it("rejeita evidência inexistente ou fora de análise", async () => {
    prisma.identityVerificationEvidenceReference.findFirst.mockResolvedValue(null);
    await expect(service.evidence("attempt")).rejects.toBeInstanceOf(NotFoundException);
  });
  it("registra decisão manual sem tocar no perfil profissional", async () => {
    tx.$queryRaw.mockResolvedValue([{ id: "attempt" }]);
    await service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "MATCH", criteriaVersion: "v1" });
    expect(tx.identityVerificationDecision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operatorUserId: "admin", source: "MANUAL", result: "CONFIRMED" }) }));
    expect(tx.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "attempt" }, data: expect.objectContaining({ status: "CLOSED", result: "CONFIRMED" }) }));
  });
  it("rejeita a segunda decisão quando o lock não encontra UNDER_REVIEW", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "MATCH", criteriaVersion: "v1" })).rejects.toBeInstanceOf(ConflictException);
  });
});
