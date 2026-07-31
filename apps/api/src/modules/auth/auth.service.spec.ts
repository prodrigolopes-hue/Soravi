import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  argon2id,
  hash as hashPassword,
} from "argon2";

import {
  ProfessionalVerificationStatus,
  Role,
  UserStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { UserResponseDto } from "../users/dto/user-response.dto";
import { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import { RegisterUserDto } from "./dto/register-user.dto";

jest.mock("argon2", () => ({
  argon2id: 2,
  hash: jest.fn(),
}));

interface TransactionClientMock {
  user: {
    create: jest.Mock;
  };
  customerProfile: {
    create: jest.Mock;
  };
  professionalProfile: {
    create: jest.Mock;
  };
}

describe("AuthService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const customerProfileId =
    "26c03da3-548b-4de6-bf75-783b1fade521";
  const professionalProfileId =
    "46c03da3-548b-4de6-bf75-783b1fade999";

  const hashPasswordMock =
    hashPassword as jest.MockedFunction<typeof hashPassword>;

  let authService: AuthService;

  let prismaMock: {
    user: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let usersServiceMock: {
    findSafeById: jest.Mock;
  };

  let transactionClientMock: TransactionClientMock;

  beforeEach(() => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    usersServiceMock = {
      findSafeById: jest.fn(),
    };

    transactionClientMock = {
      user: {
        create: jest.fn(),
      },
      customerProfile: {
        create: jest.fn(),
      },
      professionalProfile: {
        create: jest.fn(),
      },
    };

    authService = new AuthService(
      prismaMock as unknown as PrismaService,
      usersServiceMock as unknown as UsersService,
    );

    hashPasswordMock.mockReset();
    hashPasswordMock.mockResolvedValue("hashed-password");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve cadastrar um cliente dentro de uma transação", async () => {
    const input = createRegistrationInput(Role.CUSTOMER);

    prismaMock.user.findFirst.mockResolvedValue(null);

    transactionClientMock.user.create.mockResolvedValue({
      id: userId,
    });

    transactionClientMock.customerProfile.create.mockResolvedValue({
      id: customerProfileId,
      userId,
    });

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (
          transaction: TransactionClientMock,
        ) => Promise<string>,
      ) => callback(transactionClientMock),
    );

    const safeUser = createCustomerResponse();

    usersServiceMock.findSafeById.mockResolvedValue(safeUser);

    const response = await authService.register(input);

    expect(hashPasswordMock).toHaveBeenCalledWith(
      input.password,
      {
        type: argon2id,
      },
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

    expect(
      transactionClientMock.user.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Maria da Silva",
          email: "maria.teste@soravi.com.br",
          emailNormalized: "maria.teste@soravi.com.br",
          passwordHash: "hashed-password",
          phoneNormalized: "5511999999999",
          status: UserStatus.PENDING,
          roles: {
            create: {
              role: Role.CUSTOMER,
            },
          },
        }),
      }),
    );

    expect(
      transactionClientMock.customerProfile.create,
    ).toHaveBeenCalledWith({
      data: {
        userId,
      },
    });

    expect(
      transactionClientMock.professionalProfile.create,
    ).not.toHaveBeenCalled();

    expect(
      usersServiceMock.findSafeById,
    ).toHaveBeenCalledWith(userId);

    expect(response.data).toEqual(safeUser);
    expect(response.data).not.toHaveProperty("password");
    expect(response.data).not.toHaveProperty("passwordHash");
    expect(response.data).not.toHaveProperty("sessions");
  });

  it("deve cadastrar um profissional com perfil profissional", async () => {
    const input = createRegistrationInput(Role.PROFESSIONAL);

    prismaMock.user.findFirst.mockResolvedValue(null);

    transactionClientMock.user.create.mockResolvedValue({
      id: userId,
    });

    transactionClientMock.professionalProfile.create.mockResolvedValue({
      id: professionalProfileId,
      userId,
    });

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (
          transaction: TransactionClientMock,
        ) => Promise<string>,
      ) => callback(transactionClientMock),
    );

    const safeUser = createProfessionalResponse();

    usersServiceMock.findSafeById.mockResolvedValue(safeUser);

    const response = await authService.register(input);

    expect(
      transactionClientMock.professionalProfile.create,
    ).toHaveBeenCalledWith({
      data: {
        userId,
        displayName: "Maria da Silva",
      },
    });

    expect(
      transactionClientMock.customerProfile.create,
    ).not.toHaveBeenCalled();

    expect(response.data.roles).toEqual([
      Role.PROFESSIONAL,
    ]);

    expect(response.data.professionalProfile).toEqual({
      id: professionalProfileId,
      displayName: "Maria da Silva",
      verificationStatus:
        ProfessionalVerificationStatus.NOT_STARTED,
      isAvailable: true,
    });
  });

  it("deve rejeitar cadastro público com papel ADMIN", async () => {
    const input = {
      ...createRegistrationInput(Role.CUSTOMER),
      initialRole: Role.ADMIN,
    } as unknown as RegisterUserDto;

    await expect(
      authService.register(input),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deve rejeitar e-mail já utilizado", async () => {
    const input = createRegistrationInput(Role.CUSTOMER);

    prismaMock.user.findFirst.mockResolvedValue({
      id: userId,
    });

    await expect(
      authService.register(input),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(hashPasswordMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(
      usersServiceMock.findSafeById,
    ).not.toHaveBeenCalled();
  });

  it("deve normalizar o e-mail antes da consulta", async () => {
    const input = createRegistrationInput(Role.CUSTOMER);

    input.email = "  MARIA.TESTE@SORAVI.COM.BR  ";

    prismaMock.user.findFirst.mockResolvedValue({
      id: userId,
    });

    await expect(
      authService.register(input),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        emailNormalized: "maria.teste@soravi.com.br",
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  });

  function createRegistrationInput(
    initialRole: RegisterUserDto["initialRole"],
  ): RegisterUserDto {
    return {
      name: "Maria da Silva",
      email: "maria.teste@soravi.com.br",
      phone: "+55 11 99999-9999",
      password: "SenhaSegura123",
      initialRole,
      acceptedTermsVersion: "1.0",
      acceptedPrivacyPolicyVersion: "1.0",
    };
  }

  function createCustomerResponse(): UserResponseDto {
    return new UserResponseDto({
      id: userId,
      name: "Maria da Silva",
      email: "maria.teste@soravi.com.br",
      phone: "+55 11 99999-9999",
      status: UserStatus.PENDING,
      roles: [Role.CUSTOMER],
      emailVerified: false,
      phoneVerified: false,
      customerProfile: {
        id: customerProfileId,
      },
      professionalProfile: null,
      createdAt: new Date("2026-07-31T17:57:46.624Z"),
    });
  }

  function createProfessionalResponse(): UserResponseDto {
    return new UserResponseDto({
      id: userId,
      name: "Maria da Silva",
      email: "maria.teste@soravi.com.br",
      phone: "+55 11 99999-9999",
      status: UserStatus.PENDING,
      roles: [Role.PROFESSIONAL],
      emailVerified: false,
      phoneVerified: false,
      customerProfile: null,
      professionalProfile: {
        id: professionalProfileId,
        displayName: "Maria da Silva",
        verificationStatus:
          ProfessionalVerificationStatus.NOT_STARTED,
        isAvailable: true,
      },
      createdAt: new Date("2026-07-31T17:57:46.624Z"),
    });
  }
});