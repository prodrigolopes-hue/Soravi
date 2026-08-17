import "reflect-metadata";

import { PrismaService } from "../../database/prisma.service";
import { ServiceRequestStatus } from "../../generated/prisma/client";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestsMineQueryDto } from "./dto/service-requests-mine-query.dto";
import { CustomerProfileNotFoundException } from "./errors/customer-profile-not-found.exception";
import { InvalidServiceRequestCategoryException } from "./errors/invalid-service-request-category.exception";
import { ServiceRequestNotFoundException } from "./errors/service-request-not-found.exception";
import { ServiceRequestsService } from "./service-requests.service";

describe("ServiceRequestsService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const customerProfileId = "625afb87-2b81-4de7-9606-8f382fff3341";
  const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const createdAt = new Date("2026-08-16T12:00:00.000Z");

  let service: ServiceRequestsService;
  let prismaMock: {
    customerProfile: { findUnique: jest.Mock };
    category: { findFirst: jest.Mock };
    serviceRequest: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      customerProfile: { findUnique: jest.fn() },
      category: { findFirst: jest.fn() },
      serviceRequest: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new ServiceRequestsService(
      prismaMock as unknown as PrismaService,
    );
    prismaMock.customerProfile.findUnique.mockResolvedValue({
      id: customerProfileId,
    });
    prismaMock.category.findFirst.mockResolvedValue({
      id: createInput().categoryId,
    });
    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.serviceRequest.count(),
      await prismaMock.serviceRequest.findMany(),
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("cria uma solicitação em DRAFT para o perfil do usuário", async () => {
    const input = createInput();
    prismaMock.serviceRequest.create.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.DRAFT,
      ...input.location,
      createdAt,
    });

    const result = await service.createServiceRequest(userId, input);

    expect(prismaMock.customerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId },
      select: { id: true },
    });
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: input.categoryId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(prismaMock.serviceRequest.create).toHaveBeenCalledWith({
      data: {
        customerProfileId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        status: ServiceRequestStatus.DRAFT,
        ...input.location,
      },
      select: expect.any(Object),
    });
    expect(result.status).toBe(ServiceRequestStatus.DRAFT);
    expect(result.location).toEqual(input.location);
  });

  it("rejeita usuário sem CustomerProfile", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.createServiceRequest(userId, createInput()),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.category.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("rejeita categoria inexistente ou inativa", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);

    await expect(
      service.createServiceRequest(userId, createInput()),
    ).rejects.toBeInstanceOf(InvalidServiceRequestCategoryException);

    expect(prismaMock.serviceRequest.create).not.toHaveBeenCalled();
  });

  it("lista somente solicitações do CustomerProfile autenticado", async () => {
    const input = createInput();
    const query: ServiceRequestsMineQueryDto = {
      status: ServiceRequestStatus.DRAFT,
      categoryId: input.categoryId,
      page: 2,
      limit: 10,
      sort: "asc",
    };
    prismaMock.serviceRequest.count.mockResolvedValue(11);
    prismaMock.serviceRequest.findMany.mockResolvedValue([
      {
        id: serviceRequestId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        status: ServiceRequestStatus.DRAFT,
        ...input.location,
        createdAt,
      },
    ]);

    const result = await service.findMine(userId, query);

    const where = {
      customerProfileId,
      deletedAt: null,
      status: ServiceRequestStatus.DRAFT,
      categoryId: input.categoryId,
    };
    expect(prismaMock.serviceRequest.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.serviceRequest.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: "asc" },
      skip: 10,
      take: 10,
      select: expect.any(Object),
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      totalPages: 2,
    });
    expect(result.items).toHaveLength(1);
  });

  it("rejeita listagem quando o CustomerProfile não existe", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.findMine(userId, new ServiceRequestsMineQueryDto()),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.serviceRequest.count).not.toHaveBeenCalled();
    expect(prismaMock.serviceRequest.findMany).not.toHaveBeenCalled();
  });

  it("obtém somente solicitação ativa do CustomerProfile autenticado", async () => {
    const input = createInput();
    prismaMock.serviceRequest.findFirst.mockResolvedValue({
      id: serviceRequestId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      status: ServiceRequestStatus.DRAFT,
      ...input.location,
      createdAt,
    });

    const result = await service.findOneMine(userId, serviceRequestId);

    expect(prismaMock.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: serviceRequestId,
        customerProfileId,
        deletedAt: null,
      },
      select: expect.any(Object),
    });
    expect(result.id).toBe(serviceRequestId);
    expect(result.location).toEqual(input.location);
  });

  it("retorna o mesmo not found quando a solicitação não é acessível", async () => {
    prismaMock.serviceRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneMine(userId, serviceRequestId),
    ).rejects.toBeInstanceOf(ServiceRequestNotFoundException);
  });

  it("rejeita consulta quando o CustomerProfile não existe", async () => {
    prismaMock.customerProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneMine(userId, serviceRequestId),
    ).rejects.toBeInstanceOf(CustomerProfileNotFoundException);

    expect(prismaMock.serviceRequest.findFirst).not.toHaveBeenCalled();
  });
});

function createInput(): CreateServiceRequestDto {
  return {
    categoryId: "825afb87-2b81-4de7-9606-8f382fff3341",
    title: "Instalar uma tomada",
    description: "Instalação na sala.",
    location: {
      country: "BR",
      state: "SP",
      city: "Campinas",
      neighborhood: "Centro",
      postalCode: "13000-000",
      addressLine: "Rua Exemplo",
      addressNumber: "100",
      addressComplement: "Apartamento 10",
    },
  };
}
