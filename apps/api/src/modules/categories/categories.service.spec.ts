import { PrismaService } from "../../database/prisma.service";
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";

describe("CategoriesService", () => {
  let service: CategoriesService;
  let prismaMock: {
    category: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      category: {
        findMany: jest.fn(),
      },
    };

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
});
