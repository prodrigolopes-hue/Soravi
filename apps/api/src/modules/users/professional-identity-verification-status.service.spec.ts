import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";

describe("ProfessionalIdentityVerificationStatusService", () => {
  const prisma = { professionalProfile: { findFirst: jest.fn() } };
  const service = new ProfessionalIdentityVerificationStatusService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("informa ausência de documento sem ler o status de aprovação profissional", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [] });

    await expect(service.findCurrent("user")).resolves.toEqual({ status: "NOT_STARTED", result: "PENDING", requiresSelfie: false, documentSubmitted: false, selfieSubmitted: false });
  });

  it("expõe tentativa aguardando evidência que exige selfie sem alterar o status público", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: true, evidenceReferences: [{ kind: "DOCUMENT" }] }] });

    await expect(service.findCurrent("user")).resolves.toEqual({ status: "NOT_STARTED", result: "PENDING", requiresSelfie: true, documentSubmitted: true, selfieSubmitted: false });
  });

  it("preserva tentativa antiga sem requisito de selfie", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status: "AWAITING_EVIDENCE", result: "PENDING", requiresSelfie: false, evidenceReferences: [] }] });

    await expect(service.findCurrent("user")).resolves.toEqual({ status: "NOT_STARTED", result: "PENDING", requiresSelfie: false, documentSubmitted: false, selfieSubmitted: false });
  });

  it.each([
    ["UNDER_REVIEW", "PENDING", true, [{ kind: "DOCUMENT" }, { kind: "SELFIE" }]],
    ["CLOSED", "CONFIRMED", false, [{ kind: "DOCUMENT" }]],
    ["CLOSED", "INCONCLUSIVE", false, [{ kind: "DOCUMENT" }]],
  ] as const)("retorna %s/%s sem consultar a aprovação do perfil", async (status, result, requiresSelfie, evidenceReferences) => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status, result, requiresSelfie, evidenceReferences }] });

    await expect(service.findCurrent("user")).resolves.toEqual({ status, result, requiresSelfie, documentSubmitted: true, selfieSubmitted: requiresSelfie });
    expect(prisma.professionalProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ verificationStatus: expect.anything() }),
    }));
  });
});
