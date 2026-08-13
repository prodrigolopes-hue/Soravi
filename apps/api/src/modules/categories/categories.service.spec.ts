import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { PrismaService } from "../../database/prisma.service";
import { CategoriesService } from "./categories.service";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";

describe("CategoriesService", () => {
  let service: CategoriesService;
  let prismaMock: {
    category: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      category: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaMock.$transaction.mockImplementation(async () => [
      await prismaMock.category.count(),
      await prismaMock.category.findMany(),
    ]);

    service = new CategoriesService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar categorias ativas ordenadas por displayOrder e name", async () => {
    const categories = [
      {
        id: "1",
        name: "Alfaiataria",
        slug: "alfaiataria",
        description: "Roupas sob medida",
        icon: "scissors",
        displayOrder: 1,
      },
      {
        id: "2",
        name: "Beleza",
        slug: "beleza",
        description: null,
        icon: null,
        displayOrder: 2,
      },
    ];

    prismaMock.category.findMany.mockResolvedValue(categories);

    const result = await service.findActiveCategories();

    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        displayOrder: true,
      },
    });
    expect(result).toEqual(
      categories.map((category) => new CategoryResponseDto(category)),
    );
  });

  it("aplica paginação, ordenação e não filtra categories inativas na listagem administrativa", async () => {
    const query = new CategoriesAdminQueryDto();
    query.page = 2;
    query.pageSize = 10;

    prismaMock.category.count.mockResolvedValue(11);

    prismaMock.category.findMany.mockResolvedValue([
      {
        id: "1",
        name: "Alfaiataria",
        slug: "alfaiataria",
        isActive: true,
        displayOrder: 1,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-11T10:00:00.000Z"),
      },
    ]);

    const result = await service.findAllAdminCategories(query);

    expect(prismaMock.category.count).toHaveBeenCalledWith({
      where: {},
    });

    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      skip: 10,
      take: 10,
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(result).toEqual(
      new CategoriesAdminListResponseDto(
        [
          {
            id: "1",
            name: "Alfaiataria",
            slug: "alfaiataria",
            isActive: true,
            displayOrder: 1,
            createdAt: new Date("2026-08-10T10:00:00.000Z"),
            updatedAt: new Date("2026-08-11T10:00:00.000Z"),
          },
        ],
        2,
        10,
        11,
      ),
    );
  });

  it("retorna apenas os campos definidos na resposta administrativa", async () => {
    const query = new CategoriesAdminQueryDto();

    prismaMock.category.count.mockResolvedValue(1);

    prismaMock.category.findMany.mockResolvedValue([
      {
        id: "1",
        name: "Alfaiataria",
        slug: "alfaiataria",
        isActive: false,
        displayOrder: 1,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        updatedAt: new Date("2026-08-11T10:00:00.000Z"),
      },
    ]);

    const result = await service.findAllAdminCategories(query);
    const [firstItem] = result.items;

    expect(firstItem).toEqual({
      id: "1",
      name: "Alfaiataria",
      slug: "alfaiataria",
      isActive: false,
      displayOrder: 1,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      updatedAt: new Date("2026-08-11T10:00:00.000Z"),
    });

    expect(firstItem).not.toHaveProperty("description");
    expect(firstItem).not.toHaveProperty("icon");
  });

  it("valida page mínimo em 1 para listagem administrativa", async () => {
    const instance = plainToInstance(
      CategoriesAdminQueryDto,
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
      CategoriesAdminQueryDto,
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
