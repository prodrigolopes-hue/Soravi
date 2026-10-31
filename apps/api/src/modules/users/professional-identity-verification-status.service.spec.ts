import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";

describe("ProfessionalIdentityVerificationStatusService", () => {
  const prisma = { professionalProfile: { findFirst: jest.fn() } };
  const service = new ProfessionalIdentityVerificationStatusService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("informa ausência de documento sem ler o status de aprovação profissional", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [] });
    await expect(service.findCurrent("user")).resolves.toEqual({ status: "NOT_STARTED", result: "PENDING" });
  });

  it("expõe o último resultado de identidade para a tela", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status: "CLOSED", result: "NOT_CONFIRMED" }] });
    await expect(service.findCurrent("user")).resolves.toEqual({ status: "CLOSED", result: "NOT_CONFIRMED" });
  });
  it.each([
    ["UNDER_REVIEW", "PENDING"],
    ["CLOSED", "CONFIRMED"],
    ["CLOSED", "INCONCLUSIVE"],
  ] as const)("retorna %s/%s sem consultar a aprova\u00e7\u00e3o do perfil", async (status, result) => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ identityVerificationAttempts: [{ status, result }] });

    await expect(service.findCurrent("user")).resolves.toEqual({ status, result });
    expect(prisma.professionalProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ verificationStatus: expect.anything() }),
    }));
  });
});
