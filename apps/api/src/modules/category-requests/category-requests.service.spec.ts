import { PrismaService } from "../../database/prisma.service";
import {
  CategoryRequestStatus,
} from "../../generated/prisma/client";
import { CategoryRequestsService } from "./category-requests.service";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestAlreadyPendingException } from "./errors/category-request-already-pending.exception";
import { ProfessionalProfileNotFoundException } from "./errors/professional-profile-not-found.exception";

describe("CategoryRequestsService", () => {
  const userId =
    "525afb87-2b81-4de7-9606-8f382fff3341";

  const professionalProfileId =
    "professional-profile-id";

  const categoryRequestId =
    "725afb87-2b81-4de7-9606-8f382fff3341";

  const createdAt = new Date(
    "2026-08-04T18:00:00.000Z",
  );

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

    prismaMock.professionalProfile.findFirst
      .mockResolvedValue({
        id: professionalProfileId,
      });

    prismaMock.categoryRequest.findFirst
      .mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve criar uma solicitação com status PENDING", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName: "Eletricista",
      description: "Instalações residenciais.",
    };

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName: "Eletricista",
        description: "Instalações residenciais.",
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    const result =
      await service.createCategoryRequest(
        userId,
        input,
      );

    expect(
      prismaMock.professionalProfile.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName: "Eletricista",
        suggestedNameNormalized: "eletricista",
        description: "Instalações residenciais.",
        status: CategoryRequestStatus.PENDING,
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
      id: categoryRequestId,
      suggestedName: "Eletricista",
      description: "Instalações residenciais.",
      status: CategoryRequestStatus.PENDING,
      createdAt,
    });
  });

  it("deve normalizar o nome sugerido e preservar o nome original aparado", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName:
        "  Elétricista   Residêncial  ",
    };

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName:
          "Elétricista Residêncial",
        description: null,
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    const result =
      await service.createCategoryRequest(
        userId,
        input,
      );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized:
          "eletricista residencial",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName:
          "Elétricista Residêncial",
        suggestedNameNormalized:
          "eletricista residencial",
        description: null,
        status: CategoryRequestStatus.PENDING,
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
      "Elétricista Residêncial",
    );
  });

  it("deve aparar a descrição informada", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName: "Eletricista",
      description:
        "  Instalação de painéis solares.  ",
    };

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName: "Eletricista",
        description:
          "Instalação de painéis solares.",
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    await service.createCategoryRequest(
      userId,
      input,
    );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName: "Eletricista",
        suggestedNameNormalized: "eletricista",
        description:
          "Instalação de painéis solares.",
        status: CategoryRequestStatus.PENDING,
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it("deve tratar descrição opcional como nula quando ausente", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName: "Eletricista",
    };

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName: "Eletricista",
        description: null,
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    const result =
      await service.createCategoryRequest(
        userId,
        input,
      );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName: "Eletricista",
        suggestedNameNormalized: "eletricista",
        description: null,
        status: CategoryRequestStatus.PENDING,
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

  it("deve tratar descrição vazia como nula", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName: "Eletricista",
      description: "   ",
    };

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName: "Eletricista",
        description: null,
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    await service.createCategoryRequest(
      userId,
      input,
    );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName: "Eletricista",
        suggestedNameNormalized: "eletricista",
        description: null,
        status: CategoryRequestStatus.PENDING,
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it("deve rejeitar quando o perfil profissional não existe", async () => {
    prismaMock.professionalProfile.findFirst
      .mockResolvedValue(null);

    const input: CreateCategoryRequestDto = {
      suggestedName: "Eletricista",
    };

    await expect(
      service.createCategoryRequest(
        userId,
        input,
      ),
    ).rejects.toBeInstanceOf(
      ProfessionalProfileNotFoundException,
    );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.categoryRequest.create,
    ).not.toHaveBeenCalled();
  });

  it("deve rejeitar solicitação PENDING duplicada do mesmo profissional", async () => {
    prismaMock.categoryRequest.findFirst
      .mockResolvedValue({
        id: categoryRequestId,
      });

    const input: CreateCategoryRequestDto = {
      suggestedName: "Elétricista",
    };

    await expect(
      service.createCategoryRequest(
        userId,
        input,
      ),
    ).rejects.toBeInstanceOf(
      CategoryRequestAlreadyPendingException,
    );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized: "eletricista",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).not.toHaveBeenCalled();
  });

  it("deve permitir nova solicitação quando não existe outra PENDING", async () => {
    const input: CreateCategoryRequestDto = {
      suggestedName: "Instalador Solar",
    };

    prismaMock.categoryRequest.findFirst
      .mockResolvedValue(null);

    prismaMock.categoryRequest.create
      .mockResolvedValue({
        id: categoryRequestId,
        suggestedName: "Instalador Solar",
        description: null,
        status: CategoryRequestStatus.PENDING,
        createdAt,
      });

    const result =
      await service.createCategoryRequest(
        userId,
        input,
      );

    expect(
      prismaMock.categoryRequest.findFirst,
    ).toHaveBeenCalledWith({
      where: {
        professionalProfileId,
        status: CategoryRequestStatus.PENDING,
        suggestedNameNormalized:
          "instalador solar",
      },
      select: {
        id: true,
      },
    });

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledWith({
      data: {
        professionalProfileId,
        suggestedName: "Instalador Solar",
        suggestedNameNormalized:
          "instalador solar",
        description: null,
        status: CategoryRequestStatus.PENDING,
      },
      select: {
        id: true,
        suggestedName: true,
        description: true,
        status: true,
        createdAt: true,
      },
    });

    expect(result.status).toBe(
      CategoryRequestStatus.PENDING,
    );

    expect(
      prismaMock.categoryRequest.create,
    ).toHaveBeenCalledTimes(1);
  });
});