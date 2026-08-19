import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import { Role, ServiceRequestStatus } from "../../generated/prisma/client";
import { ProfessionalProfileNotFoundException } from "../category-requests/errors/professional-profile-not-found.exception";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { OpportunitiesService } from "./opportunities.service";

describe("OpportunitiesService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const professionalProfileId = "625afb87-2b81-4de7-9606-8f382fff3341";

  let service: OpportunitiesService;
  let prismaMock: {
    professionalProfile: { findFirst: jest.Mock };
    serviceOpportunity: { count: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      professionalProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: professionalProfileId }),
      },
      serviceOpportunity: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([createOpportunity()]),
      },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.serviceOpportunity.count(),
      await prismaMock.serviceOpportunity.findMany(),
    ]);
    service = new OpportunitiesService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lista somente oportunidades do ProfessionalProfile autenticado", async () => {
    const result = await service.findMine(userId, {
      page: 2,
      limit: 10,
    });

    const where = {
      professionalProfileId,
      serviceRequest: { deletedAt: null },
    };
    expect(prismaMock.professionalProfile.findFirst).toHaveBeenCalledWith({
      where: {
        userId,
        deletedAt: null,
        user: {
          deletedAt: null,
          roles: { some: { role: Role.PROFESSIONAL } },
        },
      },
      select: { id: true },
    });
    expect(prismaMock.serviceOpportunity.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.serviceOpportunity.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
      select: expect.any(Object),
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("não expõe endereço exato ou dados do cliente", async () => {
    const result = await service.findMine(userId, new OpportunitiesQueryDto());
    const item = result.items[0];

    expect(item).toEqual({
      id: "opportunity-id",
      createdAt: new Date("2026-08-19T12:00:00.000Z"),
      viewedAt: null,
      serviceRequest: {
        id: "request-id",
        title: "Instalar uma tomada",
        description: "Instalação na sala.",
        status: ServiceRequestStatus.OPEN,
        category: { id: "category-id", name: "Elétrica" },
        location: {
          state: "SP",
          city: "Campinas",
          neighborhood: "Centro",
        },
      },
    });
    expect(item.serviceRequest).not.toHaveProperty("addressLine");
    expect(item.serviceRequest).not.toHaveProperty("postalCode");
  });

  it("retorna erro padrão quando não há ProfessionalProfile ativo", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.findMine(userId, new OpportunitiesQueryDto()),
    ).rejects.toBeInstanceOf(ProfessionalProfileNotFoundException);

    expect(prismaMock.serviceOpportunity.count).not.toHaveBeenCalled();
    expect(prismaMock.serviceOpportunity.findMany).not.toHaveBeenCalled();
  });
});

function createOpportunity() {
  return {
    id: "opportunity-id",
    createdAt: new Date("2026-08-19T12:00:00.000Z"),
    viewedAt: null,
    serviceRequest: {
      id: "request-id",
      title: "Instalar uma tomada",
      description: "Instalação na sala.",
      status: ServiceRequestStatus.OPEN,
      state: "SP",
      city: "Campinas",
      neighborhood: "Centro",
      category: { id: "category-id", name: "Elétrica" },
    },
  };
}