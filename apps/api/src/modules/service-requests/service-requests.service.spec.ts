import { PrismaService } from "../../database/prisma.service";
import { ServiceRequestStatus } from "../../generated/prisma/client";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { CustomerProfileNotFoundException } from "./errors/customer-profile-not-found.exception";
import { InvalidServiceRequestCategoryException } from "./errors/invalid-service-request-category.exception";
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
    serviceRequest: { create: jest.Mock };
  };

  beforeEach(() => {
    prismaMock = {
      customerProfile: { findUnique: jest.fn() },
      category: { findFirst: jest.fn() },
      serviceRequest: { create: jest.fn() },
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