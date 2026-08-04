import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { CategoryResponseDto } from "./dto/category-response.dto";

describe("CategoriesController", () => {
  let controller: CategoriesController;
  let categoriesServiceMock: {
    findActiveCategories: jest.Mock;
  };

  beforeEach(() => {
    categoriesServiceMock = {
      findActiveCategories: jest.fn(),
    };

    controller = new CategoriesController(
      categoriesServiceMock as unknown as CategoriesService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar a lista de categorias ativas", async () => {
    const categories = [
      new CategoryResponseDto({
        id: "1",
        name: "Alfaiataria",
        slug: "alfaiataria",
        description: "Roupas sob medida",
        icon: "scissors",
        displayOrder: 1,
      }),
    ];

    categoriesServiceMock.findActiveCategories.mockResolvedValue(categories);

    const response = await controller.findAll();

    expect(categoriesServiceMock.findActiveCategories).toHaveBeenCalled();
    expect(response).toEqual(categories);
  });
});
