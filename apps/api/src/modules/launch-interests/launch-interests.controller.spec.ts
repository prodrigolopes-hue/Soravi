import { LaunchInterestsController } from "./launch-interests.controller";
import { LaunchInterestsService } from "./launch-interests.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestRegistrationResponseDto } from "./dto/launch-interest-response.dto";
import { LaunchInterestSource, LaunchInterestType } from "../../generated/prisma/client";

describe("LaunchInterestsController", () => {
  let controller: LaunchInterestsController;
  let serviceMock: {
    register: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      register: jest.fn(),
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
});