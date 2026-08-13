import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CategoryRequestsController } from "./category-requests.controller";
import { CategoryRequestsService } from "./category-requests.service";
import { CategoryRequestsAdminListResponseDto } from "./dto/category-requests-admin-list-response.dto";
import { CategoryRequestsAdminQueryDto } from "./dto/category-requests-admin-query.dto";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";

describe("CategoryRequestsController", () => {
  let controller: CategoryRequestsController;
  let serviceMock: {
    createCategoryRequest: jest.Mock;
    findAllAdminCategoryRequests: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      createCategoryRequest: jest.fn(),
      findAllAdminCategoryRequests: jest.fn(),
    };

    controller = new CategoryRequestsController(
      serviceMock as unknown as CategoryRequestsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve encaminhar usuário autenticado e DTO ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.PROFESSIONAL],
    };
    const dto: CreateCategoryRequestDto = {
      suggestedName: "Eletricista residencial",
      description: "Descrição",
    };
    const response = new CategoryRequestResponseDto({
      id: "request-id",
      suggestedName: dto.suggestedName,
      description: dto.description ?? null,
      status: "PENDING" as const,
      createdAt: new Date("2026-08-04T12:00:00.000Z"),
    });

    serviceMock.createCategoryRequest.mockResolvedValue(response);

    const result = await controller.create(currentUser, dto);

    expect(serviceMock.createCategoryRequest).toHaveBeenCalledWith(
      currentUser.id,
      dto,
    );
    expect(result).toBe(response);
  });

  it("encaminha a listagem administrativa de category requests", async () => {
    const query = new CategoryRequestsAdminQueryDto();
    const response = new CategoryRequestsAdminListResponseDto(
      [
        {
          id: "request-id",
          suggestedName: "Eletricista",
          status: "PENDING" as const,
          reviewNotes: null,
          createdAt: new Date("2026-08-04T12:00:00.000Z"),
          reviewedAt: null,
          professionalProfile: {
            id: "professional-profile-id",
            displayName: "João Silva",
            user: {
              id: "user-id",
              name: "João Silva",
              email: "joao@soravi.com.br",
            },
          },
          resolvedCategory: null,
        },
      ],
      1,
      20,
      1,
    );

    serviceMock.findAllAdminCategoryRequests.mockResolvedValue(
      response,
    );

    const result = await controller.findAdminCategoryRequests(query);

    expect(
      serviceMock.findAllAdminCategoryRequests,
    ).toHaveBeenCalledWith(query);
    expect(result).toEqual(response);
  });

  it("exige autenticação para listagem administrativa de category requests", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      CategoryRequestsController.prototype.findAdminCategoryRequests,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
  });

  it("exige role ADMIN para listagem administrativa de category requests", () => {
    const roles = Reflect.getMetadata(
      "roles",
      CategoryRequestsController.prototype.findAdminCategoryRequests,
    );

    expect(roles).toEqual([Role.ADMIN]);
  });
});
