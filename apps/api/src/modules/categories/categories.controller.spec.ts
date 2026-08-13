import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";

describe("CategoriesController", () => {
  let controller: CategoriesController;
  let categoriesServiceMock: {
    findActiveCategories: jest.Mock;
    findAllAdminCategories: jest.Mock;
  };

  beforeEach(() => {
    categoriesServiceMock = {
      findActiveCategories: jest.fn(),
      findAllAdminCategories: jest.fn(),
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

  it("encaminha a listagem administrativa de categorias", async () => {
    const query = new CategoriesAdminQueryDto();
    const response = new CategoriesAdminListResponseDto(
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
      1,
      20,
      1,
    );

    categoriesServiceMock.findAllAdminCategories.mockResolvedValue(
      response,
    );

    const result = await controller.findAdminCategories(query);

    expect(
      categoriesServiceMock.findAllAdminCategories,
    ).toHaveBeenCalledWith(query);

    expect(result).toEqual(response);
  });

  it("exige autenticação para listagem administrativa de categorias", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      CategoriesController.prototype.findAdminCategories,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
  });

  it("exige role ADMIN para listagem administrativa de categorias", () => {
    const roles = Reflect.getMetadata(
      "roles",
      CategoriesController.prototype.findAdminCategories,
    );

    expect(roles).toEqual([Role.ADMIN]);
  });
});
