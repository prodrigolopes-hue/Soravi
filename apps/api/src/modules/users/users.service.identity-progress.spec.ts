import { PrismaService } from "../../database/prisma.service";
import { ProfessionalVerificationStatus, Role, UserStatus } from "../../generated/prisma/client";
import { UsersService } from "./users.service";

describe("professional identity progress", () => {
  const findFirst = jest.fn();
  const service = new UsersService({ user: { findFirst } } as unknown as PrismaService);
  const attempt = (kinds: string[], status = "AWAITING_EVIDENCE", result = "PENDING", requiresSelfie = true) => ({ status, result, requiresSelfie, evidenceReferences: kinds.map((kind) => ({ kind })) });
  beforeEach(() => {
    findFirst.mockReset();
    findFirst.mockResolvedValue({ id: "user", name: "Profissional", email: "test@example.test", phone: null, status: UserStatus.PENDING, roles: [{ role: Role.PROFESSIONAL }], emailVerifiedAt: null, phoneVerifiedAt: null, customerProfile: null, personalIdentity: { id: "cpf" }, professionalProfile: { id: "profile", displayName: "Profissional", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, reviewNotes: null, isAvailable: true, identityVerificationAttempts: [] }, createdAt: new Date() });
  });
  it.each([
    [[], false],
    [[attempt(["DOCUMENT"])], false],
    [[attempt(["DOCUMENT", "SELFIE"], "UNDER_REVIEW")], true],
    [[attempt([], "CLOSED", "CONFIRMED")], true],
    [[attempt(["DOCUMENT", "SELFIE"], "CLOSED", "NOT_CONFIRMED")], false],
    [[attempt(["DOCUMENT"], "UNDER_REVIEW", "PENDING", false)], true],
    [[attempt(["DOCUMENT", "SELFIE"], "CANCELLED")], false],
  ])("computes progress for evidence and review states", async (identityVerificationAttempts, expected) => {
    const user = await findFirst();
    user.professionalProfile.identityVerificationAttempts = identityVerificationAttempts;
    findFirst.mockResolvedValue(user);
    const result = await service.findSafeById("user");
    expect(result.professionalRegistrationCompleted).toBe(expected);
    expect(result).not.toHaveProperty("personalIdentity");
    expect(result.professionalProfile).not.toHaveProperty("identityVerificationAttempts");
  });
});
