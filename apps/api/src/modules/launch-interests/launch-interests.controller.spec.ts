import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LaunchInterestsController } from "./launch-interests.controller";
import { LaunchInterestsService } from "./launch-interests.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestAdminQueryDto } from "./dto/launch-interest-admin-query.dto";
import { LaunchInterestRegistrationResponseDto } from "./dto/launch-interest-response.dto";
import { LaunchInterestSource, LaunchInterestType } from "../../generated/prisma/client";

describe("LaunchInterestsController", () => {
  let controller: LaunchInterestsController;
  let serviceMock: {
    register: jest.Mock;
    findAllAdmin: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      register: jest.fn(),
      findAllAdmin: jest.fn(),
    };

    controller = new LaunchInterestsController(
      serviceMock as unknown as LaunchInterestsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o DTO para o service", async () => {
    const input: CreateLaunchInterestDto = {
      name: "Maria da Silva",
      email: "maria@exemplo.com",
      phone: "+55 11 99999-9999",
      audienceType: LaunchInterestType.CUSTOMER,
      city: "São Paulo",
      state: "SP",
      serviceInterest: "Preciso de serviços residenciais",
      professionalCategoryInterest: null,
      source: LaunchInterestSource.HOME,
      privacyNoticeAccepted: true,
      marketingConsent: false,
    };

    const response = new LaunchInterestRegistrationResponseDto();
    serviceMock.register.mockResolvedValue(response);

    const result = await controller.register(input);

    expect(serviceMock.register).toHaveBeenCalledWith(input);
    expect(result).toEqual(response);
  });

  it("retorna a resposta pública esperada", async () => {
    const input: CreateLaunchInterestDto = {
      name: "Maria da Silva",
      email: "maria@exemplo.com",
      phone: "+55 11 99999-9999",
      audienceType: LaunchInterestType.CUSTOMER,
      city: "São Paulo",
      state: "SP",
      serviceInterest: "Preciso de serviços residenciais",
      professionalCategoryInterest: null,
      source: LaunchInterestSource.HOME,
      privacyNoticeAccepted: true,
      marketingConsent: false,
    };

    const response = new LaunchInterestRegistrationResponseDto();
    serviceMock.register.mockResolvedValue(response);

    const result = await controller.register(input);

    expect(result).toEqual({
      data: {
        registered: true,
        message: "Seu interesse no lançamento da Soravi foi registrado.",
      },
    });
  });

  it("encaminha o query administrativo para o service", async () => {
    const query = new LaunchInterestAdminQueryDto();
    const response = {
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    };

    serviceMock.findAllAdmin.mockResolvedValue(response);

    const result = await controller.findAllAdmin(query);

    expect(serviceMock.findAllAdmin).toHaveBeenCalledWith(query);
    expect(result).toEqual(response);
  });

  it("exige autenticação para listagem administrativa", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      LaunchInterestsController.prototype.findAllAdmin,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
  });

  it("exige role ADMIN para listagem administrativa", () => {
    const roles = Reflect.getMetadata(
      "roles",
      LaunchInterestsController.prototype.findAllAdmin,
    );

    expect(roles).toEqual([Role.ADMIN]);
  });
});