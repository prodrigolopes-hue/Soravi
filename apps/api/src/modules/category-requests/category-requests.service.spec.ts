import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { PrismaService } from "../../database/prisma.service";
import {
  CategoryRequestStatus,
} from "../../generated/prisma/client";
import { CategoryRequestsService } from "./category-requests.service";
import { CategoryRequestsAdminListResponseDto } from "./dto/category-requests-admin-list-response.dto";
import { CategoryRequestsAdminQueryDto } from "./dto/category-requests-admin-query.dto";
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
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      professionalProfile: {
        findFirst: jest.fn(),
      },
      categoryRequest: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.categoryRequest.count(),
      await prismaMock.categoryRequest.findMany(),
    ]);

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

  it("aplica paginação, ordenação por createdAt desc e não filtra status na listagem administrativa", async () => {
    const query = new CategoryRequestsAdminQueryDto();
    query.page = 2;
    query.pageSize = 10;

    prismaMock.categoryRequest.count.mockResolvedValue(11);
    prismaMock.categoryRequest.findMany.mockResolvedValue([
      {
        id: categoryRequestId,
        suggestedName: "Eletricista",
        status: CategoryRequestStatus.PENDING,
        reviewNotes: null,
        createdAt,
        reviewedAt: null,
        professionalProfile: {
          id: professionalProfileId,
          displayName: "João Silva",
          user: {
            id: userId,
            name: "João Silva",
            email: "joao@soravi.com.br",
          },
        },
        resolvedCategory: null,
      },
    ]);

    const result = await service.findAllAdminCategoryRequests(query);

    expect(prismaMock.categoryRequest.count).toHaveBeenCalledWith({
      where: {},
    });

    expect(prismaMock.categoryRequest.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: {
        createdAt: "desc",
      },
      skip: 10,
      take: 10,
      select: {
        id: true,
        suggestedName: true,
        status: true,
        reviewNotes: true,
        createdAt: true,
        reviewedAt: true,
        professionalProfile: {
          select: {
            id: true,
            displayName: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        resolvedCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    expect(result).toEqual(
      new CategoryRequestsAdminListResponseDto(
        [
          {
            id: categoryRequestId,
            suggestedName: "Eletricista",
            status: CategoryRequestStatus.PENDING,
            reviewNotes: null,
            createdAt,
            reviewedAt: null,
            professionalProfile: {
              id: professionalProfileId,
              displayName: "João Silva",
              user: {
                id: userId,
                name: "João Silva",
                email: "joao@soravi.com.br",
              },
            },
            resolvedCategory: null,
          },
        ],
        2,
        10,
        11,
      ),
    );
  });

  it("retorna apenas os campos definidos na resposta administrativa", async () => {
    const query = new CategoryRequestsAdminQueryDto();

    prismaMock.categoryRequest.count.mockResolvedValue(1);
    prismaMock.categoryRequest.findMany.mockResolvedValue([
      {
        id: categoryRequestId,
        suggestedName: "Eletricista",
        status: CategoryRequestStatus.APPROVED,
        reviewNotes: "Aprovado",
        createdAt,
        reviewedAt: new Date("2026-08-05T12:00:00.000Z"),
        professionalProfile: {
          id: professionalProfileId,
          displayName: "João Silva",
          user: {
            id: userId,
            name: "João Silva",
            email: "joao@soravi.com.br",
          },
        },
        resolvedCategory: {
          id: "category-id",
          name: "Eletricista",
          slug: "eletricista",
        },
      },
    ]);

    const result = await service.findAllAdminCategoryRequests(query);
    const [firstItem] = result.items;

    expect(firstItem).toEqual({
      id: categoryRequestId,
      suggestedName: "Eletricista",
      status: CategoryRequestStatus.APPROVED,
      reviewNotes: "Aprovado",
      createdAt,
      reviewedAt: new Date("2026-08-05T12:00:00.000Z"),
      professionalProfile: {
        id: professionalProfileId,
        displayName: "João Silva",
        user: {
          id: userId,
          name: "João Silva",
          email: "joao@soravi.com.br",
        },
      },
      resolvedCategory: {
        id: "category-id",
        name: "Eletricista",
        slug: "eletricista",
      },
    });

    expect(firstItem).not.toHaveProperty("description");
    expect(firstItem.professionalProfile.user).not.toHaveProperty("emailNormalized");
    expect(firstItem.professionalProfile.user).not.toHaveProperty("phone");
  });

  it("valida page mínimo em 1 para listagem administrativa", async () => {
    const instance = plainToInstance(
      CategoryRequestsAdminQueryDto,
      {
        page: 0,
        pageSize: 20,
      },
    );

    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        min: "O parâmetro page deve ser no mínimo 1.",
      }),
    );
  });

  it("valida pageSize máximo em 100 para listagem administrativa", async () => {
    const instance = plainToInstance(
      CategoryRequestsAdminQueryDto,
      {
        page: 1,
        pageSize: 101,
      },
    );

    const errors = await validate(instance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toEqual(
      expect.objectContaining({
        max: "O parâmetro pageSize deve ser no máximo 100.",
      }),
    );
  });
});