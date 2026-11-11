import { ProfessionalVerificationStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";

describe("ProfessionalVerificationSubmissionService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const profileId = "46c03da3-548b-4de6-bf75-783b1fade999";

  let queryRaw: jest.Mock;
  let count: jest.Mock;
  let updateMany: jest.Mock;
  let updateReview: jest.Mock;
  let deleteReviews: jest.Mock;
  let service: ProfessionalVerificationSubmissionService;

  const profile = (
    status: ProfessionalVerificationStatus,
    extra: Record<string, unknown> = {},
  ) => ({
    id: profileId,
    displayName: "Maria",
    professionalTitle: "Residential electrician",
    serviceArea: "Campinas",
    bio: "Experienced professional for residential electrical services.",
    verificationStatus: status,
    phone: "+5511999999999",
    phoneVerifiedAt: new Date(),
    emailVerifiedAt: new Date(),
    ...extra,
  });

  beforeEach(() => {
    queryRaw = jest.fn();
    count = jest.fn();
    updateMany = jest.fn();
    updateReview = jest.fn();
    deleteReviews = jest.fn();

    const transaction = {
      $queryRaw: queryRaw,
      professionalCategory: { count },
      professionalProfile: { updateMany },
      professionalVerificationReview: {
        update: updateReview,
        deleteMany: deleteReviews,
      },
    };
    service = new ProfessionalVerificationSubmissionService({
      $transaction: jest.fn(
        async (callback: (value: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    } as unknown as PrismaService);
  });

  async function submit(record: Record<string, unknown>): Promise<unknown> {
    queryRaw.mockResolvedValue([record]);
    count.mockResolvedValue(1);
    updateMany.mockResolvedValue({ count: 1 });
    return service.submit(userId);
  }

  it("moves an eligible NOT_STARTED profile to PENDING", async () => {
    await expect(
      submit(profile(ProfessionalVerificationStatus.NOT_STARTED)),
    ).resolves.toEqual({ verificationStatus: ProfessionalVerificationStatus.PENDING });
  });

  it("resubmits an eligible REJECTED profile", async () => {
    await expect(
      submit(profile(ProfessionalVerificationStatus.REJECTED)),
    ).resolves.toEqual({ verificationStatus: ProfessionalVerificationStatus.PENDING });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: profileId,
        verificationStatus: ProfessionalVerificationStatus.REJECTED,
      },
      data: {
        verificationStatus: ProfessionalVerificationStatus.PENDING,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNotes: null,
      },
    });
    expect(updateReview).not.toHaveBeenCalled();
    expect(deleteReviews).not.toHaveBeenCalled();
  });

  it.each([
    ProfessionalVerificationStatus.PENDING,
    ProfessionalVerificationStatus.APPROVED,
  ])("rejects status %s", async (status) => {
    queryRaw.mockResolvedValue([profile(status)]);

    await expect(service.submit(userId)).rejects.toMatchObject({
      response: { code: "PROFESSIONAL_VERIFICATION_STATUS_TRANSITION_NOT_ALLOWED" },
    });
  });

  it.each([
    [{ emailVerifiedAt: null }, "PROFESSIONAL_VERIFICATION_EMAIL_NOT_VERIFIED"],
  ] as const)(
    "requires the new identity prerequisites for a NOT_STARTED profile",
    async (extra, code) => {
      queryRaw.mockResolvedValue([
        profile(ProfessionalVerificationStatus.NOT_STARTED, extra),
      ]);

      await expect(service.submit(userId)).rejects.toMatchObject({
        response: { code },
      });
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ phone: null }, "PROFESSIONAL_VERIFICATION_PHONE_MISSING"],
    [{ phoneVerifiedAt: null }, "PROFESSIONAL_VERIFICATION_PHONE_NOT_VERIFIED"],
    [{ emailVerifiedAt: null }, "PROFESSIONAL_VERIFICATION_EMAIL_NOT_VERIFIED"],
    [{ professionalTitle: null }, "PROFESSIONAL_VERIFICATION_PROFESSIONAL_TITLE_MISSING"],
    [{ serviceArea: null }, "PROFESSIONAL_VERIFICATION_SERVICE_AREA_MISSING"],
    [{ bio: null }, "PROFESSIONAL_VERIFICATION_BIO_TOO_SHORT"],
    [{ bio: "Short" }, "PROFESSIONAL_VERIFICATION_BIO_TOO_SHORT"],
  ] as const)("rejects an ineligible REJECTED profile", async (extra, code) => {
    queryRaw.mockResolvedValue([
      profile(ProfessionalVerificationStatus.REJECTED, extra),
    ]);
    count.mockResolvedValue(1);

    await expect(service.submit(userId)).rejects.toMatchObject({
      response: { code },
    });
  });

  it("rejects a REJECTED profile without an active category", async () => {
    queryRaw.mockResolvedValue([profile(ProfessionalVerificationStatus.REJECTED)]);
    count.mockResolvedValue(0);

    await expect(service.submit(userId)).rejects.toMatchObject({
      response: { code: "PROFESSIONAL_VERIFICATION_ACTIVE_CATEGORY_MISSING" },
    });
  });

  it("rejects a concurrent REJECTED resubmission without touching history", async () => {
    queryRaw.mockResolvedValue([profile(ProfessionalVerificationStatus.REJECTED)]);
    count.mockResolvedValue(1);
    updateMany.mockResolvedValue({ count: 0 });

    await expect(service.submit(userId)).rejects.toMatchObject({
      response: { code: "PROFESSIONAL_VERIFICATION_STATUS_TRANSITION_NOT_ALLOWED" },
    });
    expect(updateReview).not.toHaveBeenCalled();
    expect(deleteReviews).not.toHaveBeenCalled();
  });
});
