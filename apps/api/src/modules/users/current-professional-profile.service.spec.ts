import { plainToInstance } from "class-transformer";

import { PrismaService } from "../../database/prisma.service";
import { ProfessionalVerificationStatus } from "../../generated/prisma/client";
import { UpdateCurrentProfessionalProfileDto } from "./dto/update-current-professional-profile.dto";
import { CurrentProfessionalProfileNotFoundException } from "./errors/current-professional-profile-not-found.exception";
import { InvalidProfessionalProfileCategoriesException } from "./errors/invalid-professional-profile-categories.exception";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";

describe("CurrentProfessionalProfileService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const profileId = "725afb87-2b81-4de7-9606-8f382fff3341";
  let service: CurrentProfessionalProfileService;
  let prismaMock: {
    professionalProfile: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let transactionMock: {
    professionalProfile: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    category: { findMany: jest.Mock };
    professionalCategory: { deleteMany: jest.Mock; createMany: jest.Mock };
  };

  beforeEach(() => {
    transactionMock = {
      professionalProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: profileId }),
        findUnique: jest.fn().mockResolvedValue(profile()),
        update: jest.fn().mockResolvedValue({}),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([
          { id: "category-eletrica", slug: "eletrica" },
        ]),
      },
      professionalCategory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prismaMock = {
      professionalProfile: { findFirst: jest.fn().mockResolvedValue(profile()) },
      $transaction: jest.fn((callback: (transaction: typeof transactionMock) => unknown) => callback(transactionMock)),
    };
    service = new CurrentProfessionalProfileService(prismaMock as unknown as PrismaService);
  });

  it("GET retorna o perfil e suas categorias", async () => {
    await expect(service.findCurrent(userId)).resolves.toEqual({
      id: profileId,
      displayName: "Maria Serviços",
      professionalTitle: "Eletricista residencial",
      serviceArea: "São Paulo e região",
      bio: "Atendimento residencial.",
      isAvailable: true,
      verificationStatus: ProfessionalVerificationStatus.APPROVED,
      categories: [
        { id: "category-eletrica", name: "Elétrica", slug: "eletrica" },
      ],
    });
  });

  it("PATCH atualiza os campos básicos sem alterar verificationStatus", async () => {
    await service.updateCurrent(userId, input({
      displayName: "Maria Elétrica",
      professionalTitle: "Eletricista",
      serviceArea: "Campinas",
      bio: "Atendimento comercial.",
      isAvailable: false,
    }));

    expect(transactionMock.professionalProfile.update).toHaveBeenCalledWith({
      where: { id: profileId },
      data: {
        displayName: "Maria Elétrica",
        professionalTitle: "Eletricista",
        serviceArea: "Campinas",
        bio: "Atendimento comercial.",
        isAvailable: false,
      },
    });
    expect(transactionMock.professionalProfile.update.mock.calls[0]?.[0].data)
      .not.toHaveProperty("verificationStatus");
  });

  it("PATCH substitui integralmente as categorias na mesma transação", async () => {
    const categories = [
      { id: "category-eletrica", slug: "eletrica" },
      { id: "category-pintura", slug: "pintura" },
    ];
    transactionMock.category.findMany.mockResolvedValue(categories);

    await service.updateCurrent(userId, input({ categorySlugs: ["eletrica", "pintura"] }));

    expect(transactionMock.professionalCategory.deleteMany).toHaveBeenCalledWith({
      where: { professionalProfileId: profileId },
    });
    expect(transactionMock.professionalCategory.createMany).toHaveBeenCalledWith({
      data: [
        { professionalProfileId: profileId, categoryId: "category-eletrica" },
        { professionalProfileId: profileId, categoryId: "category-pintura" },
      ],
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each<{ categorySlugs: string[] }>([
    { categorySlugs: [] },
    { categorySlugs: ["eletrica", "eletrica"] },
  ])("rejeita categorias vazias ou duplicadas", async ({ categorySlugs }) => {
    await expect(service.updateCurrent(userId, input({ categorySlugs }))).rejects.toBeInstanceOf(InvalidProfessionalProfileCategoriesException);
    expect(transactionMock.professionalProfile.update).not.toHaveBeenCalled();
  });

  it("rejeita slug inexistente ou categoria inativa", async () => {
    transactionMock.category.findMany.mockResolvedValue([]);

    await expect(service.updateCurrent(userId, input())).rejects.toBeInstanceOf(InvalidProfessionalProfileCategoriesException);
    expect(transactionMock.professionalProfile.update).not.toHaveBeenCalled();
  });

  it("preserva null para opcionais normalizados pelo DTO", async () => {
    await service.updateCurrent(userId, input({
      professionalTitle: " ",
      serviceArea: " ",
      bio: " ",
    }));

    expect(transactionMock.professionalProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        professionalTitle: null,
        serviceArea: null,
        bio: null,
      }),
    }));
  });

  it("falha se o ProfessionalProfile ativo não existir", async () => {
    transactionMock.professionalProfile.findFirst.mockResolvedValue(null);

    await expect(service.updateCurrent(userId, input())).rejects.toBeInstanceOf(CurrentProfessionalProfileNotFoundException);
    expect(transactionMock.category.findMany).not.toHaveBeenCalled();
  });

  function input(overrides: Partial<UpdateCurrentProfessionalProfileDto> = {}): UpdateCurrentProfessionalProfileDto {
    return plainToInstance(UpdateCurrentProfessionalProfileDto, {
      displayName: "Maria Serviços",
      categorySlugs: ["eletrica"],
      isAvailable: true,
      ...overrides,
    });
  }

  function profile() {
    return {
      id: profileId,
      displayName: "Maria Serviços",
      professionalTitle: "Eletricista residencial",
      serviceArea: "São Paulo e região",
      bio: "Atendimento residencial.",
      isAvailable: true,
      verificationStatus: ProfessionalVerificationStatus.APPROVED,
      professionalCategories: [
        {
          category: {
            id: "category-eletrica",
            name: "Elétrica",
            slug: "eletrica",
          },
        },
      ],
    };
  }
});
