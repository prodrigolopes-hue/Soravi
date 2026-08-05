import { CategoryRequestsController } from "./category-requests.controller";
import { CategoryRequestsService } from "./category-requests.service";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";
import { Role } from "../../generated/prisma/client";

describe("CategoryRequestsController", () => {
  let controller: CategoryRequestsController;
  let serviceMock: {
    createCategoryRequest: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      createCategoryRequest: jest.fn(),
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
});
