import { Role, ServiceRequestStatus } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestResponseDto } from "./dto/service-request-response.dto";
import { ServiceRequestsController } from "./service-requests.controller";
import { ServiceRequestsService } from "./service-requests.service";

describe("ServiceRequestsController", () => {
  const serviceMock = {
    createServiceRequest: jest.fn(),
  };

  const controller = new ServiceRequestsController(
    serviceMock as unknown as ServiceRequestsService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o usuário autenticado e o DTO ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
    };
    const input = createInput();
    const response = new ServiceRequestResponseDto({
      id: "request-id",
      categoryId: input.categoryId,
      title: input.title,
      description: input.description ?? null,
      status: ServiceRequestStatus.DRAFT,
      location: {
        ...input.location,
        addressComplement: input.location.addressComplement ?? null,
      },
      createdAt: new Date("2026-08-16T12:00:00.000Z"),
    });

    serviceMock.createServiceRequest.mockResolvedValue(response);

    const result = await controller.create(currentUser, input);

    expect(serviceMock.createServiceRequest).toHaveBeenCalledWith(
      currentUser.id,
      input,
    );
    expect(result).toBe(response);
  });

  it("exige autenticação e role CUSTOMER", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ServiceRequestsController.prototype.create,
    );
    const roles = Reflect.getMetadata(
      "roles",
      ServiceRequestsController.prototype.create,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    expect(roles).toEqual([Role.CUSTOMER]);
  });
});

function createInput(): CreateServiceRequestDto {
  return {
    categoryId: "525afb87-2b81-4de7-9606-8f382fff3341",
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