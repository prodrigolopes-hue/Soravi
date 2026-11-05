jest.mock("./professional-identity-document-image", () => ({
  processProfessionalIdentityDocument: jest.fn().mockResolvedValue({
    buffer: Buffer.from("document"), mimeType: "image/webp", sizeBytes: 8,
  }),
}));

import { ProfessionalIdentityDocumentService } from "./professional-identity-document.service";

describe("ProfessionalIdentityDocumentService", () => {
  const transaction = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    personalIdentity: { findUnique: jest.fn() },
    professionalIdentityVerificationAttempt: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    identityVerificationEvidenceReference: { create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
  };
  const prisma = {
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)),
    professionalProfile: { findFirst: jest.fn() },
  };
  const storage = { upload: jest.fn(), delete: jest.fn() };
  const service = new ProfessionalIdentityDocumentService(prisma as never, storage as never);

  beforeEach(() => {
    jest.clearAllMocks();
    storage.upload.mockResolvedValue(undefined);
    storage.delete.mockResolvedValue(undefined);
    transaction.$executeRaw.mockResolvedValue(1);
    transaction.$queryRaw
      .mockResolvedValueOnce([{ status: "PENDING" }])
      .mockResolvedValueOnce([{ id: "profile-id" }]);
    transaction.personalIdentity.findUnique.mockResolvedValue({ id: "identity-id" });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }]);
    prisma.professionalProfile.findFirst.mockResolvedValue(null);
  });

  it("cria nova tentativa apos resultado nao confirmado e preserva a anterior", async () => {
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({
      id: "closed-attempt", status: "CLOSED", result: "NOT_CONFIRMED",
    });
    transaction.professionalIdentityVerificationAttempt.create.mockResolvedValue({ id: "new-attempt" });

    await service.submitCurrent("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" });

    expect(transaction.professionalIdentityVerificationAttempt.create).toHaveBeenCalledWith({
      data: { professionalProfileId: "profile-id", personalIdentityId: "identity-id", requiresSelfie: false },
      select: { id: true, requiresSelfie: true },
    });
    expect(transaction.identityVerificationEvidenceReference.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attemptId: "new-attempt", kind: "DOCUMENT" }),
    }));
    expect(transaction.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith({
      where: { id: "new-attempt" }, data: { status: "UNDER_REVIEW" },
    });
  });

  it("mantém aguardando evidência após documento quando a nova tentativa exige selfie", async () => {
    const selfieEnabledService = new ProfessionalIdentityDocumentService(prisma as never, storage as never, { get: jest.fn().mockReturnValue("true") } as never);
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "closed-attempt", status: "CLOSED", result: "NOT_CONFIRMED", requiresSelfie: false });
    transaction.professionalIdentityVerificationAttempt.create.mockResolvedValue({ id: "selfie-attempt", requiresSelfie: true });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }]);

    await selfieEnabledService.submitCurrent("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" });

    expect(transaction.professionalIdentityVerificationAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ requiresSelfie: true }) }));
    expect(transaction.professionalIdentityVerificationAttempt.update).not.toHaveBeenCalled();
  });

  it.each([
    ["UNDER_REVIEW", "PENDING", "PROFESSIONAL_IDENTITY_DOCUMENT_ALREADY_SUBMITTED"],
    ["CLOSED", "CONFIRMED", "PROFESSIONAL_IDENTITY_ALREADY_CONFIRMED"],
  ])("recusa novo envio em %s/%s dentro da transacao", async (status, result, code) => {
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "existing", status, result });

    await expect(service.submitCurrent("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code }) });

    expect(transaction.professionalIdentityVerificationAttempt.create).not.toHaveBeenCalled();
    expect(transaction.identityVerificationEvidenceReference.create).not.toHaveBeenCalled();
  });

  it("mantém a selfie indisponível quando o recurso está desabilitado", async () => {
    await expect(service.submitSelfie("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PROFESSIONAL_IDENTITY_SELFIE_UNAVAILABLE" }) });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("permite completar uma tentativa que já exige selfie após desligar a flag", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status: "AWAITING_EVIDENCE", requiresSelfie: true }] });
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "attempt", status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: true });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }, { kind: "SELFIE" }]);

    await service.submitSelfie("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" });

    expect(storage.upload).toHaveBeenCalled();
    expect(transaction.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith({ where: { id: "attempt" }, data: { status: "UNDER_REVIEW" } });
  });

  it.each([["DOCUMENT", "SELFIE"], ["SELFIE", "DOCUMENT"]])("keeps AWAITING_EVIDENCE with %s and reaches UNDER_REVIEW with %s", async (firstKind, secondKind) => {
    const selfieEnabledService = new ProfessionalIdentityDocumentService(prisma as never, storage as never, { get: jest.fn().mockReturnValue("true") } as never);
    transaction.$queryRaw.mockReset();
    transaction.$queryRaw
      .mockResolvedValueOnce([{ status: "PENDING" }])
      .mockResolvedValueOnce([{ id: "profile-id" }])
      .mockResolvedValueOnce([{ status: "PENDING" }])
      .mockResolvedValueOnce([{ id: "profile-id" }]);
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "attempt", status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: true });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValueOnce([{ kind: firstKind }]).mockResolvedValueOnce([{ kind: "DOCUMENT" }, { kind: "SELFIE" }]);

    await (firstKind === "DOCUMENT" ? selfieEnabledService.submitCurrent("user-id", { buffer: Buffer.from("document"), declaredMimeType: "image/png" }) : selfieEnabledService.submitSelfie("user-id", { buffer: Buffer.from("selfie"), declaredMimeType: "image/png" }));
    expect(transaction.professionalIdentityVerificationAttempt.update).not.toHaveBeenCalled();

    await (secondKind === "DOCUMENT" ? selfieEnabledService.submitCurrent("user-id", { buffer: Buffer.from("document"), declaredMimeType: "image/png" }) : selfieEnabledService.submitSelfie("user-id", { buffer: Buffer.from("selfie"), declaredMimeType: "image/png" }));
    expect(transaction.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith({ where: { id: "attempt" }, data: { status: "UNDER_REVIEW" } });
  });

  it("preserves replaced evidence with supersededAt while awaiting the other evidence", async () => {
    const selfieEnabledService = new ProfessionalIdentityDocumentService(prisma as never, storage as never, { get: jest.fn().mockReturnValue("true") } as never);
    transaction.$queryRaw.mockReset();
    transaction.$queryRaw
      .mockResolvedValueOnce([{ status: "PENDING" }])
      .mockResolvedValueOnce([{ id: "profile-id" }]);
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "attempt", status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: true });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValueOnce([{ kind: "DOCUMENT" }]);

    await selfieEnabledService.submitCurrent("user-id", { buffer: Buffer.from("replacement"), declaredMimeType: "image/png" });

    expect(transaction.identityVerificationEvidenceReference.updateMany).toHaveBeenCalledWith({ where: { attemptId: "attempt", kind: "DOCUMENT", supersededAt: null }, data: { supersededAt: expect.any(Date) } });
    expect(transaction.identityVerificationEvidenceReference.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attemptId: "attempt", kind: "DOCUMENT" }) }));
    expect(transaction.professionalIdentityVerificationAttempt.update).not.toHaveBeenCalled();
  });

  it.each([["UNDER_REVIEW", "PENDING", "PROFESSIONAL_IDENTITY_DOCUMENT_ALREADY_SUBMITTED"], ["CLOSED", "CONFIRMED", "PROFESSIONAL_IDENTITY_ALREADY_CONFIRMED"]])("blocks selfie replacement in %s/%s", async (status, result, code) => {
    const selfieEnabledService = new ProfessionalIdentityDocumentService(prisma as never, storage as never, { get: jest.fn().mockReturnValue("true") } as never);
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "attempt", status, result, requiresSelfie: true });

    await expect(selfieEnabledService.submitSelfie("user-id", { buffer: Buffer.from("replacement"), declaredMimeType: "image/png" })).rejects.toMatchObject({ response: expect.objectContaining({ code }) });

    expect(transaction.identityVerificationEvidenceReference.updateMany).not.toHaveBeenCalled();
    expect(transaction.identityVerificationEvidenceReference.create).not.toHaveBeenCalled();
  });

  it("keeps a legacy attempt without a selfie requirement", async () => {
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "legacy-attempt", status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: false });

    await service.submitCurrent("user-id", { buffer: Buffer.from("document"), declaredMimeType: "image/png" });

    expect(transaction.professionalIdentityVerificationAttempt.create).not.toHaveBeenCalled();
    expect(transaction.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith({ where: { id: "legacy-attempt" }, data: { status: "UNDER_REVIEW" } });
  });

  it("does not reuse evidence from the previous attempt", async () => {
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({ id: "closed-attempt", status: "CLOSED", result: "NOT_CONFIRMED", requiresSelfie: true });
    transaction.professionalIdentityVerificationAttempt.create.mockResolvedValue({ id: "new-attempt", requiresSelfie: true });
    transaction.identityVerificationEvidenceReference.findMany.mockResolvedValue([{ kind: "DOCUMENT" }]);

    await service.submitCurrent("user-id", { buffer: Buffer.from("document"), declaredMimeType: "image/png" });

    expect(transaction.identityVerificationEvidenceReference.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ attemptId: "new-attempt" }) }));
    expect(transaction.identityVerificationEvidenceReference.findMany).toHaveBeenCalledWith({ where: { attemptId: "new-attempt", supersededAt: null }, select: { kind: true } });
  });
});
