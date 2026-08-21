import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import { Role, ServiceRequestStatus } from "../../generated/prisma/client";
import { StorageService } from "../../storage/storage.service";
import { ProfessionalProfileNotFoundException } from "../category-requests/errors/professional-profile-not-found.exception";
import { OpportunityNotFoundException } from "./errors/opportunity-not-found.exception";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { OpportunitiesService } from "./opportunities.service";

describe("OpportunitiesService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const professionalProfileId = "625afb87-2b81-4de7-9606-8f382fff3341";

  let service: OpportunitiesService;
  let prismaMock: {
    professionalProfile: { findFirst: jest.Mock };
    serviceOpportunity: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let storageMock: {
    upload: jest.Mock;
    delete: jest.Mock;
    createTemporaryReadUrl: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      professionalProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: professionalProfileId }),
      },
      serviceOpportunity: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(createOpportunity()),
        findMany: jest.fn().mockResolvedValue([createOpportunity()]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.serviceOpportunity.count(),
      await prismaMock.serviceOpportunity.findMany(),
    ]);
    storageMock = {
      upload: jest.fn(),
      delete: jest.fn(),
      createTemporaryReadUrl: jest.fn().mockResolvedValue(
        "https://cdn.example.test/signed-photo.jpg",
      ),
    };
    service = new OpportunitiesService(
      prismaMock as unknown as PrismaService,
      storageMock as unknown as StorageService,
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

  it("obtém somente oportunidade própria com ServiceRequest não excluída", async () => {
    const opportunityId = "725afb87-2b81-4de7-9606-8f382fff3341";

    const result = await service.findOneMine(userId, opportunityId);

    expect(prismaMock.serviceOpportunity.findFirst).toHaveBeenCalledWith({
      where: {
        id: opportunityId,
        professionalProfileId,
        serviceRequest: { deletedAt: null },
      },
      select: expect.any(Object),
    });
    expect(result).toEqual({
      opportunityId: "opportunity-id",
      createdAt: new Date("2026-08-19T12:00:00.000Z"),
      viewedAt: null,
      conversationId: null,
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
        photos: [],
      },
    });
  });

  it.each(["inexistente", "de outro profissional", "com solicitação excluída"])(
    "retorna 404 neutro para oportunidade %s",
    async () => {
      prismaMock.serviceOpportunity.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneMine(userId, "725afb87-2b81-4de7-9606-8f382fff3341"),
      ).rejects.toBeInstanceOf(OpportunityNotFoundException);
    },
  );

  it("não expõe dados privados nem marca a oportunidade como visualizada", async () => {
    const result = await service.findOneMine(
      userId,
      "725afb87-2b81-4de7-9606-8f382fff3341",
    );

    expect(result.conversationId).toBeNull();
    expect(result.serviceRequest).not.toHaveProperty("postalCode");
    expect(result.serviceRequest).not.toHaveProperty("addressLine");
    expect(result.serviceRequest).not.toHaveProperty("customerProfile");
    expect(result.serviceRequest).not.toHaveProperty("contractId");
    expect(result.serviceRequest).not.toHaveProperty("customerProfileId");
    expect(prismaMock.serviceOpportunity).not.toHaveProperty("update");
  });

  it("oportunidade contratada do profissional retorna conversationId", async () => {
    prismaMock.serviceOpportunity.findFirst.mockResolvedValue({
      ...createOpportunity(),
      serviceRequest: {
        ...createOpportunity().serviceRequest,
        status: ServiceRequestStatus.HIRED,
        contract: {
          professionalProfileId,
          conversation: { id: "conversation-id" },
        },
      },
    });

    const result = await service.findOneMine(
      userId,
      "725afb87-2b81-4de7-9606-8f382fff3341",
    );

    expect(result.conversationId).toBe("conversation-id");
    expect(result).not.toHaveProperty("contractId");
    expect(result).not.toHaveProperty("customerProfileId");
    expect(result.serviceRequest).not.toHaveProperty("contract");
  });

  it("oportunidade sem Contract retorna conversationId null", async () => {
    prismaMock.serviceOpportunity.findFirst.mockResolvedValue({
      ...createOpportunity(),
      serviceRequest: {
        ...createOpportunity().serviceRequest,
        status: ServiceRequestStatus.HIRED,
        contract: null,
      },
    });

    const result = await service.findOneMine(
      userId,
      "725afb87-2b81-4de7-9606-8f382fff3341",
    );

    expect(result.conversationId).toBeNull();
  });

  it("Contract sem Conversation retorna conversationId null", async () => {
    prismaMock.serviceOpportunity.findFirst.mockResolvedValue({
      ...createOpportunity(),
      serviceRequest: {
        ...createOpportunity().serviceRequest,
        status: ServiceRequestStatus.HIRED,
        contract: {
          professionalProfileId,
          conversation: null,
        },
      },
    });

    const result = await service.findOneMine(
      userId,
      "725afb87-2b81-4de7-9606-8f382fff3341",
    );

    expect(result.conversationId).toBeNull();
  });

  it("marca oportunidade própria não visualizada e retorna o detalhe seguro", async () => {
    const opportunityId = "725afb87-2b81-4de7-9606-8f382fff3341";
    const beforeMarking = Date.now();
    prismaMock.serviceOpportunity.findFirst.mockResolvedValueOnce({
      ...createOpportunity(),
      viewedAt: new Date("2026-08-19T12:30:00.000Z"),
    });

    const result = await service.markViewed(userId, opportunityId);
    const afterMarking = Date.now();

    expect(prismaMock.serviceOpportunity.updateMany).toHaveBeenCalledWith({
      where: {
        id: opportunityId,
        professionalProfileId,
        viewedAt: null,
        serviceRequest: { deletedAt: null },
      },
      data: { viewedAt: expect.any(Date) },
    });
    const viewedAt = prismaMock.serviceOpportunity.updateMany.mock.calls[0]?.[0]
      .data.viewedAt as Date;
    expect(viewedAt.getTime()).toBeGreaterThanOrEqual(beforeMarking);
    expect(viewedAt.getTime()).toBeLessThanOrEqual(afterMarking);
    expect(result.viewedAt).toEqual(new Date("2026-08-19T12:30:00.000Z"));
    expect(result.serviceRequest).not.toHaveProperty("postalCode");
    expect(result.serviceRequest).not.toHaveProperty("addressLine");
  });

  it("retorna fotos ordenadas e assinadas sem expor objectKey", async () => {
    const opportunityId = "725afb87-2b81-4de7-9606-8f382fff3341";
    const lowerPositionPhoto = {
      id: "file-1",
      objectKey: "images/first.jpg",
      originalName: "first.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 150,
      position: 1,
    };
    const higherPositionPhoto = {
      id: "file-2",
      objectKey: "images/second.png",
      originalName: "second.png",
      mimeType: "image/png",
      sizeBytes: 200,
      position: 2,
    };

    prismaMock.serviceOpportunity.findFirst.mockResolvedValueOnce({
      ...createOpportunity(),
      serviceRequest: {
        ...createOpportunity().serviceRequest,
        files: [lowerPositionPhoto, higherPositionPhoto],
      },
    });
    storageMock.createTemporaryReadUrl
      .mockResolvedValueOnce("https://cdn.example.test/first.jpg")
      .mockResolvedValueOnce("https://cdn.example.test/second.png");

    const result = await service.findOneMine(userId, opportunityId);

    expect(storageMock.createTemporaryReadUrl).toHaveBeenNthCalledWith(
      1,
      lowerPositionPhoto.objectKey,
      300,
    );
    expect(storageMock.createTemporaryReadUrl).toHaveBeenNthCalledWith(
      2,
      higherPositionPhoto.objectKey,
      300,
    );
    expect(result.serviceRequest.photos).toEqual([
      expect.objectContaining({
        id: lowerPositionPhoto.id,
        originalName: lowerPositionPhoto.originalName,
        mimeType: lowerPositionPhoto.mimeType,
        sizeBytes: lowerPositionPhoto.sizeBytes,
        position: lowerPositionPhoto.position,
        url: "https://cdn.example.test/first.jpg",
      }),
      expect.objectContaining({
        id: higherPositionPhoto.id,
        originalName: higherPositionPhoto.originalName,
        mimeType: higherPositionPhoto.mimeType,
        sizeBytes: higherPositionPhoto.sizeBytes,
        position: higherPositionPhoto.position,
        url: "https://cdn.example.test/second.png",
      }),
    ]);
    expect(result.serviceRequest.photos[0]).not.toHaveProperty("objectKey");
    expect(result.serviceRequest.photos[1]).not.toHaveProperty("objectKey");
  });

  it("preserva o viewedAt original na segunda chamada", async () => {
    const originalViewedAt = new Date("2026-08-19T12:30:00.000Z");
    prismaMock.serviceOpportunity.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.serviceOpportunity.findFirst.mockResolvedValue({
      ...createOpportunity(),
      viewedAt: originalViewedAt,
    });

    const result = await service.markViewed(
      userId,
      "725afb87-2b81-4de7-9606-8f382fff3341",
    );

    expect(prismaMock.serviceOpportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewedAt: null }),
      }),
    );
    expect(result.viewedAt).toBe(originalViewedAt);
  });

  it.each(["inexistente", "de outro profissional", "com solicitação excluída"])(
    "retorna 404 neutro ao marcar oportunidade %s",
    async () => {
      prismaMock.serviceOpportunity.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.serviceOpportunity.findFirst.mockResolvedValue(null);

      await expect(
        service.markViewed(userId, "725afb87-2b81-4de7-9606-8f382fff3341"),
      ).rejects.toBeInstanceOf(OpportunityNotFoundException);
    },
  );
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
      contract: null,
      files: [],
    },
  };
}