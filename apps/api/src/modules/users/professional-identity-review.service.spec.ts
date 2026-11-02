import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createCpfProtector } from "../../common/cpf/cpf-protection";
import { ProfessionalIdentityReviewService } from "./professional-identity-review.service";

describe("ProfessionalIdentityReviewService", () => {
  const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn().mockResolvedValue(1), identityVerificationDecision: { create: jest.fn() }, identityCpfAccessAudit: { create: jest.fn() }, identitySelfieAccessAudit: { create: jest.fn() }, identityVerificationEvidenceReference: { findMany: jest.fn(), findFirst: jest.fn() }, professionalIdentityVerificationAttempt: { update: jest.fn(), findUnique: jest.fn() } };
  const prisma = { professionalIdentityVerificationAttempt: { findMany: jest.fn(), findUnique: jest.fn() }, identityVerificationEvidenceReference: { findFirst: jest.fn() }, $queryRaw: jest.fn(), $transaction: jest.fn((fn) => fn(tx)) };
  const storage = { createTemporaryReadUrl: jest.fn().mockResolvedValue("https://private.example/temporary") };
  const service = new ProfessionalIdentityReviewService(prisma as never, storage as never);
  beforeEach(() => { jest.clearAllMocks(); tx.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }]); });
  it("seleciona o documento ativo da tentativa solicitada", async () => {
    prisma.$queryRaw.mockResolvedValue([{ reference: "private/active-document", expiresAt: null }]);
    await expect(service.evidence("attempt")).resolves.toEqual({ url: "https://private.example/temporary", expiresInSeconds: 60 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.createTemporaryReadUrl).toHaveBeenCalledWith("private/active-document", 60);
  });
  it("não considera documento substituído elegível", async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.evidence("attempt-with-superseded-document")).rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_UNAVAILABLE" }) });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
  it("não emite URL quando não há documento ativo", async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.evidence("attempt")).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
  it("mantém acessível a tentativa legada com documento ativo", async () => {
    prisma.$queryRaw.mockResolvedValue([{ reference: "private/legacy-document", expiresAt: null }]);

    await expect(service.evidence("legacy-attempt")).resolves.toEqual({ url: "https://private.example/temporary", expiresInSeconds: 60 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.createTemporaryReadUrl).toHaveBeenCalledWith("private/legacy-document", 60);
  });
  it.each(["pendente", "concluído"])("não emite URL para documento com descarte %s", async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(service.evidence("attempt")).rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_EVIDENCE_UNAVAILABLE" }) });
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
  it("audita o acesso à selfie antes de emitir URL temporária", async () => {
    tx.$queryRaw.mockResolvedValue([{ reference: "private/selfie", expiresAt: null }]);
    await expect(service.selfieEvidence("admin", "attempt")).resolves.toEqual({ url: "https://private.example/temporary", expiresInSeconds: 60 });
    expect(tx.identitySelfieAccessAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ attemptId: "attempt", operatorUserId: "admin", action: "ADMIN_IDENTITY_SELFIE_VIEW" }) });
  });
  it("não emite URL de selfie se a auditoria falhar", async () => {
    tx.$queryRaw.mockResolvedValue([{ reference: "private/selfie", expiresAt: null }]);
    tx.identitySelfieAccessAudit.create.mockRejectedValue(new Error("audit failed"));
    await expect(service.selfieEvidence("admin", "attempt")).rejects.toThrow("audit failed");
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
  it.each(["pendente", "concluído"])("não emite URL para selfie com descarte %s", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.selfieEvidence("admin", "attempt")).rejects.toMatchObject({ response: expect.objectContaining({ code: "IDENTITY_SELFIE_UNAVAILABLE" }) });
    expect(tx.identitySelfieAccessAudit.create).not.toHaveBeenCalled();
    expect(storage.createTemporaryReadUrl).not.toHaveBeenCalled();
  });
  it("registra aplicação e liberação da suspensão como eventos de auditoria", async () => {
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: "attempt" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "attempt" }])
      .mockResolvedValueOnce([{ action: "APPLIED" }]);

    await expect(service.suspendEvidenceDisposal("admin", "attempt", "Investigação aberta")).resolves.toMatchObject({ attemptId: "attempt", suspendedAt: expect.any(Date) });
    await expect(service.releaseEvidenceDisposalSuspension("admin", "attempt", "Investigação encerrada")).resolves.toMatchObject({ attemptId: "attempt", releasedAt: expect.any(Date) });
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(1, expect.objectContaining({
      strings: expect.arrayContaining([expect.stringContaining("'APPLIED'")]),
      values: expect.arrayContaining(["Investigação aberta"]),
    }));
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(2, expect.objectContaining({
      strings: expect.arrayContaining([expect.stringContaining("'RELEASED'")]),
      values: expect.arrayContaining(["Investigação encerrada"]),
    }));
  });
  it("desfaz a suspensão quando a auditoria não pode ser registrada", async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ id: "attempt" }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    tx.$executeRaw.mockRejectedValue(new Error("audit failed"));

    await expect(service.suspendEvidenceDisposal("admin", "attempt", "Investigação aberta")).rejects.toThrow("audit failed");
    expect(tx.$executeRaw).toHaveBeenCalledWith(expect.objectContaining({
      strings: expect.arrayContaining([expect.stringContaining("'APPLIED'")]),
      values: expect.arrayContaining(["Investigação aberta"]),
    }));
    expect(prisma.$transaction).toHaveBeenCalled();
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
  it("não registra decisão quando falta selfie ativa exigida", async () => {
    tx.$queryRaw.mockResolvedValue([{ id: "attempt", requiresSelfie: true }]);
    tx.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }]);
    await expect(service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", criteriaVersion: "v1" })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.identityVerificationDecision.create).not.toHaveBeenCalled();
  });
  it("rejeita combinações novas de resultado e motivo que não são permitidas", async () => {
    await expect(service.decide("admin", "attempt", { result: "CONFIRMED", reasonCode: "DATA_MISMATCH", criteriaVersion: "v1" })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("details não busca envelope nem retorna CPF", async () => {
    prisma.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({
      id: "attempt",
      status: "CLOSED",
      result: "CONFIRMED",
      createdAt: new Date(),
      closedAt: new Date(),
      requiresSelfie: false,
      evidenceReferences: [],
      professionalProfile: {
        displayName: "Ana",
        identityVerificationAttempts: [{
          id: "legacy-attempt",
          status: "CLOSED",
          result: "CONFIRMED",
          createdAt: new Date(),
          closedAt: new Date(),
          requiresSelfie: false,
          decisions: [{ result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", createdAt: new Date("2026-10-31T12:00:00.000Z"), operator: { name: "Administradora" } }],
          evidenceReferences: [],
        }],
      },
    });
    const result = await service.details("attempt");
    expect(JSON.stringify(result)).not.toContain("cpf");
    expect(JSON.stringify(result)).not.toContain("cpfEnvelope");
    expect(prisma.professionalIdentityVerificationAttempt.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.not.objectContaining({ personalIdentity: expect.anything() }) }));
    expect(result.attempt.hasActiveSelfie).toBe(false);
    const legacyResponse = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(legacyResponse).toMatchObject({
      attempt: { status: "CLOSED", result: "CONFIRMED", requiresSelfie: false, hasActiveSelfie: false },
      professionalName: "Ana",
      history: [{
        id: "legacy-attempt",
        status: "CLOSED",
        result: "CONFIRMED",
        requiresSelfie: false,
        documentSubmitted: false,
        selfieSubmitted: false,
        decisions: [{ result: "CONFIRMED", reasonCode: "DOCUMENT_CHECKED", operator: { name: "Administradora" } }],
      }],
    });
    expect(JSON.stringify(legacyResponse)).not.toContain("email");
  });
  it("details indica somente a existência de selfie ativa", async () => {
    prisma.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({ id: "attempt", status: "UNDER_REVIEW", result: "PENDING", createdAt: new Date(), closedAt: null, requiresSelfie: true, evidenceReferences: [{ id: "active-selfie" }], professionalProfile: { displayName: "Ana", identityVerificationAttempts: [] } });
    await expect(service.details("attempt")).resolves.toMatchObject({ attempt: { hasActiveSelfie: true } });
    expect(prisma.professionalIdentityVerificationAttempt.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ evidenceReferences: expect.objectContaining({ where: { kind: "SELFIE", supersededAt: null }, select: { id: true } }) }) }));
  });
  it.each(["ausente", "substituída"])('não indica selfie ativa quando ela está %s', async () => {
    prisma.professionalIdentityVerificationAttempt.findUnique.mockResolvedValue({ id: "attempt", status: "UNDER_REVIEW", result: "PENDING", createdAt: new Date(), closedAt: null, requiresSelfie: true, evidenceReferences: [], professionalProfile: { displayName: "Ana", identityVerificationAttempts: [] } });
    await expect(service.details("attempt")).resolves.toMatchObject({ attempt: { hasActiveSelfie: false } });
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
