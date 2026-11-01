import { ProfessionalPortfolioModerationStatus } from "../../generated/prisma/client";
import { ProfessionalPortfolioService } from "./professional-portfolio.service";

describe("ProfessionalPortfolioService grouped pending queue", () => {
  it("queries pending non-removed photos grouped by professional with stable pagination", async () => {
    const professionals = [{ id: "professional-a", displayName: "Ana", portfolioItems: [{ id: "photo-a", caption: "Trabalho", createdAt: new Date(), moderationVersion: 1 }] }];
    const prisma = { professionalProfile: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue(professionals) }, professionalPortfolioItem: { count: jest.fn().mockResolvedValue(1) }, $queryRaw: jest.fn().mockResolvedValue([{ id: "professional-a" }]), $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)) };
    const service = new ProfessionalPortfolioService(prisma as never, {} as never);
    await expect(service.listPendingGrouped()).resolves.toEqual({ items: professionals, pagination: { page: 1, limit: 5, totalProfessionals: 1, totalPendingPhotos: 1, totalPages: 1 } });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.professionalProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["professional-a"] } } }));
    expect(prisma.professionalPortfolioItem.count).toHaveBeenCalledWith({ where: { deletedAt: null, moderationStatus: ProfessionalPortfolioModerationStatus.PENDING } });
  });
});
