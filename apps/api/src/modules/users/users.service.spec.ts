import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
  ProfessionalVerificationStatus,
  Role,
  UserStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let usersService: UsersService;

  const countMock = jest.fn();
  const findManyMock = jest.fn();

  let prismaMock: {
    user: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    countMock.mockReset();
    findManyMock.mockReset();

    prismaMock = {
      user: {
        count: countMock,
        findMany: findManyMock,
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaMock.$transaction.mockImplementation(async (operations: unknown[]) => {
      await Promise.resolve();
      return [
        await countMock(),
        await findManyMock(),
      ];
    });

    usersService = new UsersService(
      prismaMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("aplica paginação, ordenação desc e filtro de clientes ativos", async () => {
    const query = new UsersAdminCustomersQueryDto();
    query.page = 2;
    query.pageSize = 10;

    countMock.mockResolvedValue(11);

    findManyMock.mockResolvedValue([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Cliente A",
        email: "cliente.a@soravi.com.br",
        phone: "+55 11 90000-0001",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date("2026-08-01T10:00:00.000Z"),
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
      },
    ]);

    const result = await usersService.findAllAdminCustomers(query);

    expect(countMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        customerProfile: {
          isNot: null,
        },
        roles: {
          some: {
            role: Role.CUSTOMER,
          },
        },
      },
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        customerProfile: {
          isNot: null,
        },
        roles: {
          some: {
            role: Role.CUSTOMER,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: 10,
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        createdAt: true,
      },
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
  });

  it("não expõe campos sensíveis na resposta", async () => {
    const query = new UsersAdminCustomersQueryDto();

    countMock.mockResolvedValue(1);

    findManyMock.mockResolvedValue([
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Cliente A",
        email: "cliente.a@soravi.com.br",
        phone: null,
        status: UserStatus.PENDING,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
      },
    ]);

    const result = await usersService.findAllAdminCustomers(query);
    const [firstItem] = result.items;

    expect(firstItem).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Cliente A",
      email: "cliente.a@soravi.com.br",
      phone: null,
      status: UserStatus.PENDING,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
    });

    expect(firstItem).not.toHaveProperty("passwordHash");
    expect(firstItem).not.toHaveProperty("deletedAt");
    expect(firstItem).not.toHaveProperty("emailVerifiedAt");
    expect(firstItem).not.toHaveProperty("phoneVerifiedAt");
    expect(firstItem).not.toHaveProperty("sessions");
  });

  it("valida pageSize máximo em 100", async () => {
    const instance = plainToInstance(
      UsersAdminCustomersQueryDto,
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

  it("aplica paginação, ordenação desc e filtro de profissionais ativos com perfil", async () => {
    const query = new UsersAdminProfessionalsQueryDto();
    query.page = 2;
    query.pageSize = 10;

    countMock.mockResolvedValue(11);

    findManyMock.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Profissional A",
        email: "profissional.a@soravi.com.br",
        phone: "+55 11 90000-0002",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date("2026-08-01T10:00:00.000Z"),
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        professionalProfile: {
          id: "46c03da3-548b-4de6-bf75-783b1fade999",
          displayName: "Profissional A",
          verificationStatus: ProfessionalVerificationStatus.NOT_STARTED,
          isAvailable: true,
        },
      },
    ]);

    const result = await usersService.findAllAdminProfessionals(query);

    expect(countMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        roles: {
          some: {
            role: Role.PROFESSIONAL,
          },
        },
        professionalProfile: {
          is: {
            deletedAt: null,
          },
        },
      },
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        roles: {
          some: {
            role: Role.PROFESSIONAL,
          },
        },
        professionalProfile: {
          is: {
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: 10,
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        createdAt: true,
        professionalProfile: {
          select: {
            id: true,
            displayName: true,
            verificationStatus: true,
            isAvailable: true,
          },
        },
      },
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 11,
      totalPages: 2,
    });
  });

  it("não expõe campos sensíveis na resposta administrativa de profissionais", async () => {
    const query = new UsersAdminProfessionalsQueryDto();

    countMock.mockResolvedValue(1);

    findManyMock.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Profissional A",
        email: "profissional.a@soravi.com.br",
        phone: null,
        status: UserStatus.PENDING,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        professionalProfile: {
          id: "46c03da3-548b-4de6-bf75-783b1fade999",
          displayName: "Profissional A",
          verificationStatus: ProfessionalVerificationStatus.NOT_STARTED,
          isAvailable: true,
        },
      },
    ]);

    const result = await usersService.findAllAdminProfessionals(query);
    const [firstItem] = result.items;

    expect(firstItem).toEqual({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Profissional A",
      email: "profissional.a@soravi.com.br",
      phone: null,
      status: UserStatus.PENDING,
      emailVerified: false,
      phoneVerified: false,
      createdAt: new Date("2026-08-10T10:00:00.000Z"),
      professionalProfile: {
        id: "46c03da3-548b-4de6-bf75-783b1fade999",
        displayName: "Profissional A",
        verificationStatus: ProfessionalVerificationStatus.NOT_STARTED,
        isAvailable: true,
      },
    });

    expect(firstItem).not.toHaveProperty("passwordHash");
    expect(firstItem).not.toHaveProperty("deletedAt");
    expect(firstItem).not.toHaveProperty("emailVerifiedAt");
    expect(firstItem).not.toHaveProperty("phoneVerifiedAt");
    expect(firstItem).not.toHaveProperty("sessions");
    expect(firstItem).not.toHaveProperty("legalAcceptances");
    expect(firstItem.professionalProfile).not.toHaveProperty("bio");
    expect(firstItem.professionalProfile).not.toHaveProperty("averageRating");
    expect(firstItem.professionalProfile).not.toHaveProperty("reviewCount");
    expect(firstItem.professionalProfile).not.toHaveProperty("servicesCompletedCount");
  });

  it("ignora registros sem professionalProfile no mapeamento final", async () => {
    const query = new UsersAdminProfessionalsQueryDto();

    countMock.mockResolvedValue(2);

    findManyMock.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Profissional A",
        email: "profissional.a@soravi.com.br",
        phone: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-10T10:00:00.000Z"),
        professionalProfile: null,
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Profissional B",
        email: "profissional.b@soravi.com.br",
        phone: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        createdAt: new Date("2026-08-09T10:00:00.000Z"),
        professionalProfile: {
          id: "56c03da3-548b-4de6-bf75-783b1fade111",
          displayName: "Profissional B",
          verificationStatus: ProfessionalVerificationStatus.PENDING,
          isAvailable: false,
        },
      },
    ]);

    const result = await usersService.findAllAdminProfessionals(query);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("valida pageSize máximo em 100 para profissionais", async () => {
    const instance = plainToInstance(
      UsersAdminProfessionalsQueryDto,
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