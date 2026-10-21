import "reflect-metadata";
import { ProfessionalVerificationStatus, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PublicProfessionalDiscoveryQueryDto } from "./dto/public-professional-discovery-query.dto";
import { PublicCategoryNotFoundException } from "./errors/public-category-not-found.exception";
import { PublicProfessionalNotFoundException } from "./errors/public-professional-not-found.exception";
import { ProfessionalDiscoveryService } from "./professional-discovery.service";

describe("ProfessionalDiscoveryService", () => {
  const category = { id: "category-id" };
  const professional = {
    id: "professional-id",
    displayName: "Profissional público",
    professionalTitle: "Eletricista",
    serviceArea: "Niterói",
    bio: "Atendimento residencial.",
    professionalCategories: [{ category: { id: "category-id", name: "Elétrica", slug: "eletrica" } }],
  };
  let prisma: {
    category: { findFirst: jest.Mock };
    professionalProfile: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    review: { groupBy: jest.Mock; count: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: ProfessionalDiscoveryService;

  beforeEach(() => {
    prisma = {
      category: { findFirst: jest.fn().mockResolvedValue(category) },
      professionalProfile: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([professional]),
        findFirst: jest.fn().mockResolvedValue(professional),
      },
      review: {
        groupBy: jest.fn().mockResolvedValue([{ professionalProfileId: professional.id, _avg: { rating: 4.5 }, _count: { _all: 2 } }]),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ rating: 5, comment: "Ótimo atendimento", publishedAt: new Date("2026-10-10T10:00:00.000Z") }]),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: { _all: 1 } }),
      },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    service = new ProfessionalDiscoveryService(prisma as unknown as PrismaService);
  });

  it("rejeita categoria inexistente ou inativa", async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.findByCategory("inativa", new PublicProfessionalDiscoveryQueryDto()))
      .rejects.toBeInstanceOf(PublicCategoryNotFoundException);
    expect(prisma.professionalProfile.count).not.toHaveBeenCalled();
  });

  it("lista apenas profissionais elegíveis, com paginação e resposta pública restrita", async () => {
    const query = Object.assign(new PublicProfessionalDiscoveryQueryDto(), { page: 2, limit: 10 });

    const result = await service.findByCategory("eletrica", query);

    expect(prisma.professionalProfile.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        verificationStatus: ProfessionalVerificationStatus.APPROVED,
        isAvailable: true,
        user: { deletedAt: null, status: UserStatus.ACTIVE },
        professionalCategories: { some: { categoryId: category.id, category: { isActive: true } } },
      }),
    });
    expect(prisma.professionalProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ displayName: "asc" }, { id: "asc" }], skip: 10, take: 10,
    }));
    expect(result).toEqual({
      items: [{
        id: professional.id,
        displayName: professional.displayName,
        professionalTitle: professional.professionalTitle,
        serviceArea: professional.serviceArea,
        categories: [{ id: "category-id", name: "Elétrica", slug: "eletrica" }],
        reputation: { averageRating: 4.5, reviewCount: 2 },
      }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(result.items[0]).not.toHaveProperty("bio");
    expect(prisma.professionalProfile.findMany.mock.calls[0][0].select).not.toHaveProperty("averageRating");
    expect(prisma.professionalProfile.findMany.mock.calls[0][0].select).not.toHaveProperty("reviewCount");
  });

  it("retorna 404 para perfil inelegível", async () => {
    prisma.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(service.findOne(professional.id, new PublicProfessionalDiscoveryQueryDto()))
      .rejects.toBeInstanceOf(PublicProfessionalNotFoundException);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });

  it("usa somente avaliações publicadas para reputação e página de avaliações", async () => {
    const query = Object.assign(new PublicProfessionalDiscoveryQueryDto(), { page: 2, limit: 5 });

    const result = await service.findOne(professional.id, query);

    expect(prisma.professionalProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        professionalCategories: { some: { category: { isActive: true } } },
      }),
    }));
    expect(prisma.review.count).toHaveBeenCalledWith({
      where: { professionalProfileId: professional.id, publishedAt: { not: null } },
    });
    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { professionalProfileId: professional.id, publishedAt: { not: null } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: 5, take: 5,
      select: { rating: true, comment: true, publishedAt: true },
    }));
    expect(result.reputation).toEqual({ averageRating: 5, reviewCount: 1 });
    expect(result.reviews).toEqual({
      items: [{ rating: 5, comment: "Ótimo atendimento", publishedAt: new Date("2026-10-10T10:00:00.000Z") }],
      pagination: { page: 2, limit: 5, total: 1, totalPages: 1 },
    });
    expect(Object.keys(result).sort()).toEqual([
      "bio", "categories", "displayName", "id", "professionalTitle",
      "reputation", "reviews", "serviceArea",
    ]);
    expect(Object.keys(result.reviews.items[0]).sort()).toEqual(["comment", "publishedAt", "rating"]);
  });
});
