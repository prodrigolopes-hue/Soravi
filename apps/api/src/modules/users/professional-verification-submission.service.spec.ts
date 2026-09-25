import { ProfessionalVerificationStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";

describe("ProfessionalVerificationSubmissionService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const profileId = "46c03da3-548b-4de6-bf75-783b1fade999";
  let queryRaw: jest.Mock;
  let count: jest.Mock;
  let updateMany: jest.Mock;
  let service: ProfessionalVerificationSubmissionService;

  beforeEach(() => {
    queryRaw = jest.fn(); count = jest.fn(); updateMany = jest.fn();
    const transaction = { $queryRaw: queryRaw, professionalCategory: { count }, professionalProfile: { updateMany } };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };
    service = new ProfessionalVerificationSubmissionService(prisma as unknown as PrismaService);
  });

  it("envia perfil elegivel de NOT_STARTED para PENDING", async () => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, phone: "+5511999999999", phoneVerifiedAt: new Date() }]);
    count.mockResolvedValue(1); updateMany.mockResolvedValue({ count: 1 });
    await expect(service.submit(userId)).resolves.toEqual({ verificationStatus: ProfessionalVerificationStatus.PENDING });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: profileId, verificationStatus: ProfessionalVerificationStatus.NOT_STARTED }, data: { verificationStatus: ProfessionalVerificationStatus.PENDING } }));
  });

  it.each([ProfessionalVerificationStatus.PENDING, ProfessionalVerificationStatus.APPROVED, ProfessionalVerificationStatus.REJECTED])("rejeita status %s", async (verificationStatus) => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus, phone: "+5511999999999", phoneVerifiedAt: new Date() }]);
    await expect(service.submit(userId)).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_STATUS_TRANSITION_NOT_ALLOWED" } });
  });

  it("rejeita telefone ausente", async () => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, phone: null, phoneVerifiedAt: null }]);
    await expect(service.submit(userId)).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_PHONE_MISSING" } });
  });

  it("rejeita telefone nao verificado", async () => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, phone: "+5511999999999", phoneVerifiedAt: null }]);
    await expect(service.submit(userId)).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_PHONE_NOT_VERIFIED" } });
  });

  it("rejeita ausencia de categoria ativa", async () => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, phone: "+5511999999999", phoneVerifiedAt: new Date() }]);
    count.mockResolvedValue(0);
    await expect(service.submit(userId)).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_ACTIVE_CATEGORY_MISSING" } });
  });

  it("rejeita a segunda submissao concorrente", async () => {
    queryRaw.mockResolvedValue([{ id: profileId, displayName: "Maria", verificationStatus: ProfessionalVerificationStatus.NOT_STARTED, phone: "+5511999999999", phoneVerifiedAt: new Date() }]);
    count.mockResolvedValue(1); updateMany.mockResolvedValue({ count: 0 });
    await expect(service.submit(userId)).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_STATUS_TRANSITION_NOT_ALLOWED" } });
  });
});
