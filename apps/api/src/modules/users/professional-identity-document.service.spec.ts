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
    identityVerificationEvidenceReference: { create: jest.fn() },
  };
  const prisma = {
    $executeRaw: jest.fn(),
    $transaction: jest.fn(async (work: (tx: typeof transaction) => unknown) => work(transaction)),
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
  });

  it("cria nova tentativa apos resultado nao confirmado e preserva a anterior", async () => {
    transaction.professionalIdentityVerificationAttempt.findFirst.mockResolvedValue({
      id: "closed-attempt", status: "CLOSED", result: "NOT_CONFIRMED",
    });
    transaction.professionalIdentityVerificationAttempt.create.mockResolvedValue({ id: "new-attempt" });

    await service.submitCurrent("user-id", { buffer: Buffer.from("upload"), declaredMimeType: "image/png" });

    expect(transaction.professionalIdentityVerificationAttempt.create).toHaveBeenCalledWith({
      data: { professionalProfileId: "profile-id", personalIdentityId: "identity-id" },
      select: { id: true },
    });
    expect(transaction.identityVerificationEvidenceReference.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ attemptId: "new-attempt", kind: "DOCUMENT" }),
    }));
    expect(transaction.professionalIdentityVerificationAttempt.update).toHaveBeenCalledWith({
      where: { id: "new-attempt" }, data: { status: "UNDER_REVIEW" },
    });
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
});
