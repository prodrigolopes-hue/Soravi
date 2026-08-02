import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  argon2id,
  hash as hashPassword,
  verify as verifyPassword,
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
import { AuthTokensService } from "./auth-tokens.service";
import { LoginUserDto } from "./dto/login-user.dto";
import { RegisterUserDto } from "./dto/register-user.dto";

jest.mock("argon2", () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
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
  const sessionId =
    "725afb87-2b81-4de7-9606-8f382fff3341";
  const validRefreshToken =
    "valid-refresh-token-with-more-than-thirty-two-characters";
  const hashPasswordMock =
    hashPassword as jest.MockedFunction<typeof hashPassword>;
  const verifyPasswordMock =
    verifyPassword as jest.MockedFunction<
      typeof verifyPassword
    >;

  let authService: AuthService;

  let prismaMock: {
    user: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    authSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  let usersServiceMock: {
    findSafeById: jest.Mock;
  };

  let authTokensServiceMock: {
    createTokens: jest.Mock;
    hashRefreshToken: jest.Mock;
  };

  let transactionClientMock: TransactionClientMock;

  beforeEach(() => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prismaMock.user.update.mockResolvedValue({
      id: userId,
    });

    prismaMock.authSession.create.mockResolvedValue({
      id: "session-id-test",
    });

    prismaMock.authSession.findUnique.mockResolvedValue(null);

    prismaMock.authSession.updateMany.mockResolvedValue({
      count: 1,
    });

    prismaMock.$transaction.mockImplementation(
      async (
        input:
          | ((
            transaction: TransactionClientMock,
          ) => Promise<unknown>)
          | Promise<unknown>[],
      ) => {
        if (typeof input === "function") {
          return input(transactionClientMock);
        }

        return Promise.all(input);
      },
    );

    usersServiceMock = {
      findSafeById: jest.fn(),
    };

    authTokensServiceMock = {
      createTokens: jest.fn(),
      hashRefreshToken: jest.fn(),
    };

    authTokensServiceMock.hashRefreshToken.mockReturnValue(
      "current-refresh-token-hash",
    );

    authTokensServiceMock.createTokens.mockResolvedValue({
      accessToken: "access-token-test",
      refreshToken: "refresh-token-test",
      refreshTokenHash: "refresh-token-hash-test",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresAt: new Date(
        "2026-08-31T12:00:00.000Z",
      ),
    });

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
      authTokensServiceMock as unknown as AuthTokensService,
    );

    hashPasswordMock.mockReset();
    hashPasswordMock.mockResolvedValue("hashed-password");

    verifyPasswordMock.mockReset();
    verifyPasswordMock.mockResolvedValue(true);
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
      emailNormalized: "maria.teste@soravi.com.br",
      phoneNormalized: null,
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

  it("deve normalizar o e-mail antes da consulta de cadastro", async () => {
    const input = createRegistrationInput(Role.CUSTOMER);

    input.email = "  MARIA.TESTE@SORAVI.COM.BR  ";

    prismaMock.user.findFirst.mockResolvedValue({
      emailNormalized: "maria.teste@soravi.com.br",
      phoneNormalized: null,
    });

    await expect(
      authService.register(input),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            emailNormalized: "maria.teste@soravi.com.br",
          },
          {
            phoneNormalized: "5511999999999",
          },
        ],
        deletedAt: null,
      },
      select: {
        emailNormalized: true,
        phoneNormalized: true,
      },
    });
  });

  it.each([
    UserStatus.PENDING,
    UserStatus.ACTIVE,
  ])(
    "deve permitir login para usuário com status %s",
    async (status) => {
      const input = createLoginInput();

      prismaMock.user.findFirst.mockResolvedValue({
        id: userId,
        passwordHash: "hashed-password",
        status,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      });

      const safeUser = createCustomerResponse(status);

      usersServiceMock.findSafeById.mockResolvedValue(safeUser);

      const response = await authService.login(input);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          emailNormalized: "maria.teste@soravi.com.br",
          deletedAt: null,
        },
        select: {
          id: true,
          passwordHash: true,
          status: true,
          roles: {
            select: {
              role: true,
            },
          },
        },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
        data: {
          lastLoginAt: expect.any(Date),
        },
      });
      expect(
        usersServiceMock.findSafeById,
      ).toHaveBeenCalledWith(userId);

      expect(response.data.user).toEqual(safeUser);

      expect(response.data.user).not.toHaveProperty("password");
      expect(response.data.user).not.toHaveProperty(
        "passwordHash",
      );
      expect(response.data.user).not.toHaveProperty("sessions");

      expect(response.data.accessToken).toBe(
        "access-token-test",
      );
      expect(response.data.refreshToken).toBe(
        "refresh-token-test",
      );
      expect(response.data.accessTokenExpiresIn).toBe(900);
    },
  );

  it("deve normalizar o e-mail antes da consulta de login", async () => {
    const input: LoginUserDto = {
      ...createLoginInput(),
      email: "  MARIA.TESTE@SORAVI.COM.BR  ",
    };

    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.login(input),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        emailNormalized: "maria.teste@soravi.com.br",
        deletedAt: null,
      },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        roles: {
          select: {
            role: true,
          },
        },
      },
    });
  });

  it("deve rejeitar login quando o e-mail não existe", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      authService.login(createLoginInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(
      usersServiceMock.findSafeById,
    ).not.toHaveBeenCalled();
  });

  it("deve rejeitar login quando a senha está incorreta", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: userId,
      passwordHash: "hashed-password",
      status: UserStatus.ACTIVE,
      roles: [
        {
          role: Role.CUSTOMER,
        },
      ],
    });

    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      authService.login(createLoginInput()),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(verifyPasswordMock).toHaveBeenCalledWith(
      "hashed-password",
      "SenhaSegura123",
    );

    expect(
      usersServiceMock.findSafeById,
    ).not.toHaveBeenCalled();
  });

  it.each([
    UserStatus.SUSPENDED,
    UserStatus.BLOCKED,
    UserStatus.DEACTIVATED,
  ])(
    "deve rejeitar login para usuário com status %s",
    async (status) => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: userId,
        passwordHash: "hashed-password",
        status,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      });

      await expect(
        authService.login(createLoginInput()),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(verifyPasswordMock).toHaveBeenCalledWith(
        "hashed-password",
        "SenhaSegura123",
      );

      expect(
        usersServiceMock.findSafeById,
      ).not.toHaveBeenCalled();
    },
  );
  it("deve renovar os tokens e rotacionar a sessão", async () => {
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    prismaMock.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      expiresAt,
      revokedAt: null,
      user: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      },
    });

    const response = await authService.refresh({
      refreshToken: validRefreshToken,
    });

    expect(
      authTokensServiceMock.hashRefreshToken,
    ).toHaveBeenCalledWith(validRefreshToken);

    expect(
      prismaMock.authSession.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        refreshTokenHash:
          "current-refresh-token-hash",
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            status: true,
            deletedAt: true,
            roles: {
              select: {
                role: true,
              },
            },
          },
        },
      },
    });

    expect(
      authTokensServiceMock.createTokens,
    ).toHaveBeenCalledWith({
      userId,
      sessionId,
      roles: [Role.CUSTOMER],
    });

    expect(
      prismaMock.authSession.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        refreshTokenHash:
          "current-refresh-token-hash",
        revokedAt: null,
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        refreshTokenHash:
          "refresh-token-hash-test",
        expiresAt: new Date(
          "2026-08-31T12:00:00.000Z",
        ),
        lastUsedAt: expect.any(Date),
      },
    });

    expect(response.data).toEqual({
      accessToken: "access-token-test",
      refreshToken: "refresh-token-test",
      accessTokenExpiresIn: 900,
    });
  });

  it("deve rejeitar refresh token inexistente", async () => {
    prismaMock.authSession.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      authService.refresh({
        refreshToken: validRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      authTokensServiceMock.createTokens,
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.authSession.updateMany,
    ).not.toHaveBeenCalled();
  });

  it("deve rejeitar sessão revogada", async () => {
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      expiresAt: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ),
      revokedAt: new Date(),
      user: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      },
    });

    await expect(
      authService.refresh({
        refreshToken: validRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      authTokensServiceMock.createTokens,
    ).not.toHaveBeenCalled();
  });

  it("deve rejeitar sessão expirada", async () => {
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      expiresAt: new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ),
      revokedAt: null,
      user: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      },
    });

    await expect(
      authService.refresh({
        refreshToken: validRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(
      authTokensServiceMock.createTokens,
    ).not.toHaveBeenCalled();
  });

  it("deve rejeitar reutilização do refresh token", async () => {
    prismaMock.authSession.findUnique.mockResolvedValue({
      id: sessionId,
      userId,
      expiresAt: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ),
      revokedAt: null,
      user: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: [
          {
            role: Role.CUSTOMER,
          },
        ],
      },
    });

    prismaMock.authSession.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      authService.refresh({
        refreshToken: validRefreshToken,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("deve revogar a sessão no logout", async () => {
    await authService.logout({
      refreshToken: validRefreshToken,
    });

    expect(
      authTokensServiceMock.hashRefreshToken,
    ).toHaveBeenCalledWith(validRefreshToken);

    expect(
      prismaMock.authSession.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        refreshTokenHash:
          "current-refresh-token-hash",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
      },
    });
  });

  it("deve concluir logout mesmo quando a sessão não existe", async () => {
    prismaMock.authSession.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      authService.logout({
        refreshToken: validRefreshToken,
      }),
    ).resolves.toBeUndefined();
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

  function createLoginInput(): LoginUserDto {
    return {
      email: "maria.teste@soravi.com.br",
      password: "SenhaSegura123",
    };
  }

  function createCustomerResponse(
    status: UserStatus = UserStatus.PENDING,
  ): UserResponseDto {
    return new UserResponseDto({
      id: userId,
      name: "Maria da Silva",
      email: "maria.teste@soravi.com.br",
      phone: "+55 11 99999-9999",
      status,
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
