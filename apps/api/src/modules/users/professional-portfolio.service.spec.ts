import { BadRequestException, NotFoundException } from "@nestjs/common";

import { ProfessionalPortfolioService } from "./professional-portfolio.service";

jest.mock("./professional-profile-photo-image", () => ({ processProfessionalProfilePhoto: jest.fn(async () => ({ buffer: Buffer.from("image"), mimeType: "image/webp", width: 512, height: 512, sizeBytes: 5 })) }));

describe("ProfessionalPortfolioService", () => {
  const prisma = { professionalProfile: { findFirst: jest.fn() }, professionalPortfolioItem: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() }, $transaction: jest.fn(), $queryRaw: jest.fn() };
  const storage = { upload: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfessionalPortfolioService(prisma as never, storage as never);
  beforeEach(() => jest.clearAllMocks());

  it("bloqueia a criação ao atingir 12 fotos", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue({ id: "profile" }); prisma.professionalPortfolioItem.count.mockResolvedValue(12);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    await expect(service.addCurrent("owner", { buffer: Buffer.from("x") })).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("não remove uma foto que não pertence ao profissional atual", async () => {
    prisma.professionalPortfolioItem.findFirst.mockResolvedValue(null);
    await expect(service.removeCurrent("other-owner", "00000000-0000-4000-8000-000000000000")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.professionalPortfolioItem.delete).not.toHaveBeenCalled();
  });
});
