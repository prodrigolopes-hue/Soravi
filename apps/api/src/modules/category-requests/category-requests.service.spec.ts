import { PrismaService } from "../../database/prisma.service";
import { CategoryRequestsService } from "./category-requests.service";
import { CategoryRequestAlreadyPendingException } from "./errors/category-request-already-pending.exception";
import { ProfessionalProfileNotFoundException } from "./errors/professional-profile-not-found.exception";
import { CategoryRequestStatus } from "../../generated/prisma/client";

describe("CategoryRequestsService", () => {
  let service: CategoryRequestsService;
  let prismaMock: {
    professionalProfile: {
      findFirst: jest.Mock;
    };
    categoryRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      professionalProfile: {
        findFirst: jest.fn(),
      },
      categoryRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new CategoryRequestsService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve criar solicitação PENDING usando o perfil profissional do usuário autenticado", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue({
      id: "professional-profile-id",
    });
    prismaMock.categoryRequest.findFirst.mockResolvedValue(null);
    prismaMock.categoryRequest.create.mockResolvedValue({
      id: "request-id",
      suggestedName: "Eletricista residencial",
      description: "Descrição opcional",
      status: CategoryRequestStatus.PENDING,
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });

    const result = await service.createCategoryRequest(
      "user-id",
      {
        suggestedName: "Eletricista residencial",
        description: "Descrição opcional",
      },
    );

    expect(prismaMock.professionalProfile.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-id",
        deletedAt: null,
      },
    });
    expect(prismaMock.categoryRequest.findFirst).toHaveBeenCalledWith({
      where: {
        professionalProfileId: "professional-profile-id",
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista residencial",
      },
    });
    expect(prismaMock.categoryRequest.create).toHaveBeenCalledWith({
      data: {
        professionalProfileId: "professional-profile-id",
        suggestedName: "Eletricista residencial",
        suggestedNameNormalized: "eletricista residencial",
        description: "Descrição opcional",
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
    expect(result).toEqual({
      id: "request-id",
      suggestedName: "Eletricista residencial",
      description: "Descrição opcional",
      status: CategoryRequestStatus.PENDING,
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });
  });

  it("deve normalizar o nome sugerido e preservar o nome original aparado", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue({
      id: "professional-profile-id",
    });
    prismaMock.categoryRequest.findFirst.mockResolvedValue(null);
    prismaMock.categoryRequest.create.mockResolvedValue({
      id: "request-id",
      suggestedName: "  Eletricista   Residencial  ",
      description: null,
      status: CategoryRequestStatus.PENDING,
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });

    const result = await service.createCategoryRequest(
      "user-id",
      {
        suggestedName: "  Elétricista   Residêncial  ",
      },
    );

    expect(prismaMock.categoryRequest.findFirst).toHaveBeenCalledWith({
      where: {
        professionalProfileId: "professional-profile-id",
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista residencial",
      },
    });
    expect(prismaMock.categoryRequest.create).toHaveBeenCalledWith({
      data: {
        professionalProfileId: "professional-profile-id",
        suggestedName: "  Elétricista   Residêncial  ",
        suggestedNameNormalized: "eletricista residencial",
        description: null,
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
    expect(result.suggestedName).toBe(
      "  Elétricista   Residêncial  ",
    );
  });

  it("deve tratar descrição opcional como nula quando ausente", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue({
      id: "professional-profile-id",
    });
    prismaMock.categoryRequest.findFirst.mockResolvedValue(null);
    prismaMock.categoryRequest.create.mockResolvedValue({
      id: "request-id",
      suggestedName: "Eletricista",
      description: null,
      status: CategoryRequestStatus.PENDING,
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });

    const result = await service.createCategoryRequest(
      "user-id",
      {
        suggestedName: "Eletricista",
      },
    );

    expect(prismaMock.categoryRequest.create).toHaveBeenCalledWith({
      data: {
        professionalProfileId: "professional-profile-id",
        suggestedName: "Eletricista",
        suggestedNameNormalized: "eletricista",
        description: null,
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
    expect(result.description).toBeNull();
  });

  it("deve rejeitar quando o perfil profissional não existir", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(
      service.createCategoryRequest("user-id", {
        suggestedName: "Eletricista",
      }),
    ).rejects.toBeInstanceOf(
      ProfessionalProfileNotFoundException,
    );
  });

  it("deve rejeitar solicitação pendente duplicada apenas para mesmo profissional", async () => {
    prismaMock.professionalProfile.findFirst.mockResolvedValue({
      id: "professional-profile-id",
    });
    prismaMock.categoryRequest.findFirst.mockResolvedValue({
      id: "existing-request-id",
    });

    await expect(
      service.createCategoryRequest("user-id", {
        suggestedName: "Eletricista",
      }),
    ).rejects.toBeInstanceOf(
      CategoryRequestAlreadyPendingException,
    );
  });
});
