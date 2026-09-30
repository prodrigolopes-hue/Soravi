import { ProfessionalVerificationStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";

describe("ProfessionalVerificationReviewService", () => {
  const adminUserId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const userId = "46c03da3-548b-4de6-bf75-783b1fade999";
  const profileId = "725afb87-2b81-4de7-9606-8f382fff3341";
  let queryRaw: jest.Mock; let updateMany: jest.Mock; let createReview: jest.Mock; let updateReview: jest.Mock; let deleteReviews: jest.Mock; let service: ProfessionalVerificationReviewService;
  beforeEach(() => {
    queryRaw = jest.fn(); updateMany = jest.fn(); createReview = jest.fn(); updateReview = jest.fn(); deleteReviews = jest.fn();
    const transaction = { $queryRaw: queryRaw, professionalProfile: { updateMany }, professionalVerificationReview: { create: createReview, update: updateReview, deleteMany: deleteReviews } };
    service = new ProfessionalVerificationReviewService({ $transaction: jest.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) } as unknown as PrismaService);
  });
  function pending(): void { queryRaw.mockResolvedValue([{ id: profileId, verificationStatus: ProfessionalVerificationStatus.PENDING }]); }
  it.each([ProfessionalVerificationStatus.APPROVED, ProfessionalVerificationStatus.REJECTED])("revisa PENDING para %s e persiste metadados", async (status) => {
    pending(); updateMany.mockResolvedValue({ count: 1 });
    const result = await service.review(adminUserId, userId, { status, reviewNotes: "nota" });
    expect(result).toMatchObject({ userId, verificationStatus: status, reviewedByUserId: adminUserId, reviewNotes: "nota" });
    expect(result.reviewedAt).toBeInstanceOf(Date);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewedByUserId: adminUserId, reviewNotes: "nota" }) }));
    expect(createReview).toHaveBeenCalledWith({ data: expect.objectContaining({ professionalProfileId: profileId, fromStatus: ProfessionalVerificationStatus.PENDING, toStatus: status, reviewNotes: "nota", reviewedByUserId: adminUserId, createdAt: result.reviewedAt }) });
    expect(updateReview).not.toHaveBeenCalled();
    expect(deleteReviews).not.toHaveBeenCalled();
  });
  it.each([ProfessionalVerificationStatus.NOT_STARTED, ProfessionalVerificationStatus.APPROVED, ProfessionalVerificationStatus.REJECTED])("rejeita estado atual %s", async (verificationStatus) => {
    queryRaw.mockResolvedValue([{ id: profileId, verificationStatus }]);
    await expect(service.review(adminUserId, userId, { status: ProfessionalVerificationStatus.APPROVED })).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_REVIEW_TRANSITION_NOT_ALLOWED" } });
    expect(createReview).not.toHaveBeenCalled();
  });
  it("rejeita alvo sem perfil profissional", async () => { queryRaw.mockResolvedValue([]); await expect(service.review(adminUserId, userId, { status: ProfessionalVerificationStatus.APPROVED })).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_REVIEW_TARGET_NOT_FOUND" } }); });
  it("rejeita segunda revisao concorrente sem criar historico", async () => { pending(); updateMany.mockResolvedValue({ count: 0 }); await expect(service.review(adminUserId, userId, { status: ProfessionalVerificationStatus.REJECTED })).rejects.toMatchObject({ response: { code: "PROFESSIONAL_VERIFICATION_REVIEW_TRANSITION_NOT_ALLOWED" } }); expect(createReview).not.toHaveBeenCalled(); });
});
