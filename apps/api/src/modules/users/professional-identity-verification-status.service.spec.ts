import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";

describe("ProfessionalIdentityVerificationStatusService", () => {
  const prisma = { professionalProfile: { findFirst: jest.fn() } };
  const service = new ProfessionalIdentityVerificationStatusService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("informa ausência de documento sem ler o status de aprovação profissional", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ verificationAttempts: [] });
    await expect(service.findCurrent("user")).resolves.toEqual({ status: "NOT_STARTED", result: "PENDING" });
  });

  it("expõe o último resultado de identidade para a tela", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ verificationAttempts: [{ status: "CLOSED", result: "NOT_CONFIRMED" }] });
    await expect(service.findCurrent("user")).resolves.toEqual({ status: "CLOSED", result: "NOT_CONFIRMED" });
  });
});
