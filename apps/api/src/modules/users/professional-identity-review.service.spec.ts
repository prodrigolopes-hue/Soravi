import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createCpfProtector } from "../../common/cpf/cpf-protection";
import { ProfessionalIdentityReviewService } from "./professional-identity-review.service";

describe("ProfessionalIdentityReviewService", () => {
  const tx = { $queryRaw: jest.fn(), identityVerificationDecision: { create: jest.fn() }, identityCpfAccessAudit: { create: jest.fn() }, professionalIdentityVerificationAttempt: { update: jest.fn(), findUnique: jest.fn() } };
  const prisma = { professionalIdentityVerificationAttempt: { findMany: jest.fn(), findUnique: jest.fn() }, identityVerificationEvidenceReference: { findFirst: jest.fn() }, $transaction: jest.fn((fn) => fn(tx)) };
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
    await service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" });
    expect(tx.identityVerificationDecision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ operatorUserId: "admin", source: "MANUAL", result: "CONFIRMED" }) }));
    expect(tx.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "attempt" }, data: expect.objectContaining({ status: "CLOSED", result: "CONFIRMED" }) }));
  });
  it("rejeita a segunda decisão quando o lock não encontra UNDER_REVIEW", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" })).rejects.toBeInstanceOf(ConflictException);
  });
  it("rejeita combinações novas de resultado e motivo que não são permitidas", async () => {
    await expect(service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "DATA_MISMATCH", criteriaVersion: "v1" })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("details não busca envelope nem retorna CPF", async () => {
    prisma.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({ id: "attempt", status: "CLOSED", result: "CONFIRMED", createdAt: new Date(), closedAt: new Date(), professionalProfile: { displayName: "Ana", identityVerificationAttempts: [] } });
    const result = await service.details("attempt");
    expect(JSON.stringify(result)).not.toContain("cpf");
  });
  it("não descriptografa nem retorna CPF se a auditoria falhar", async () => {
    tx.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({ personalIdentity: { cpfEnvelope: {} } });
    tx.identityCpfAccessAudit.create.mockRejectedValue(new Error("audit failed"));
    await expect(service.revealCpf("admin", "attempt")).rejects.toThrow("audit failed");
  });
  it("persists the complete audit before decrypting CPF", async () => {
    const encryptionKey = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
    const hmacKey = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";
    const cpf = "52998224725";
    const envelope = createCpfProtector({ encryptionKey: Buffer.from(encryptionKey, "base64"), hmacKey: Buffer.from(hmacKey, "base64"), encryptionKeyId: "cpf-encryption-v1" }).encrypt(cpf);
    const order: string[] = [];
    const values: Record<string, string> = { PERSONAL_IDENTITY_RECORDING_ENABLED: "true", CPF_ENCRYPTION_KEY: encryptionKey, CPF_ENCRYPTION_KEY_ID: "cpf-encryption-v1", CPF_HMAC_KEY: hmacKey, CPF_HMAC_KEY_ID: "cpf-hmac-v1" };
    const config = { get: jest.fn((key: string) => { order.push("decrypt-configuration"); return values[key]; }) };
    const configuredService = new ProfessionalIdentityReviewService(prisma as never, storage as never, config as never);
    tx.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({ personalIdentity: { cpfEnvelope: envelope } });
    tx.identityCpfAccessAudit.create.mockImplementation(async () => { order.push("audit"); return {}; });

    await expect(configuredService.revealCpf("admin-id", "attempt-id")).resolves.toEqual({ cpf });

    expect(order.indexOf("audit")).toBeLessThan(order.indexOf("decrypt-configuration"));
    expect(tx.identityCpfAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ attemptId: "attempt-id", operatorUserId: "admin-id", action: "ADMIN_IDENTITY_CPF_REVEAL", accessedAt: expect.any(Date) }) });
    expect(JSON.stringify(tx.identityCpfAccessAudit.create.mock.calls)).not.toContain(cpf);
  });
  it("rejects a missing attempt before auditing or decrypting", async () => {
    const config = { get: jest.fn() };
    const configuredService = new ProfessionalIdentityReviewService(prisma as never, storage as never, config as never);
    tx.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue(null);

    await expect(configuredService.revealCpf("admin", "missing")).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.identityCpfAccessAudit.create).not.toHaveBeenCalled();
    expect(config.get).not.toHaveBeenCalled();
  });
});
