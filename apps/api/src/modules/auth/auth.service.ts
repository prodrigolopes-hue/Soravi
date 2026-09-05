import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import {
  argon2id,
  hash as hashPassword,
  verify as verifyPassword,
} from "argon2";

import { normalizeBrazilianPhoneToE164 } from "../../common/phone/brazilian-phone";
import { PrismaService } from "../../database/prisma.service";
import {
  LegalDocumentType,
  Prisma,
  Role,
  UserStatus,
} from "../../generated/prisma/client";
import { UsersService } from "../users/users.service";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { AccountUnavailableException } from "./errors/account-unavailable.exception";
import { EmailAlreadyInUseException } from "./errors/email-already-in-use.exception";
import { InvalidCredentialsException } from "./errors/invalid-credentials.exception";
import { PhoneAlreadyInUseException } from "./errors/phone-already-in-use.exception";
import { InvalidRefreshTokenException } from "./errors/invalid-refresh-token.exception";
import { AuthTokensService } from "./auth-tokens.service";
import {
  capAuthSessionExpiresAt,
  getAuthSessionAbsoluteExpiresAt,
} from "./auth-session-lifetime";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

interface LoginSessionResult {
  response: LoginResponseDto;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface RefreshSessionResult {
  response: RefreshResponseDto;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const PUBLIC_REGISTRATION_ROLES: readonly Role[] = [
  Role.CUSTOMER,
  Role.PROFESSIONAL,
];

const LOGIN_ALLOWED_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly authTokensService: AuthTokensService,
  ) { }

  async register(
    input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    this.ensurePublicRegistrationRole(input.initialRole);

    const professionalCategorySlugs =
      input.initialRole === Role.PROFESSIONAL
        ? this.validateProfessionalCategorySlugs(
            input.categorySlugs,
          )
        : [];

    const normalizedEmail = this.normalizeEmail(input.email);
    const presentedPhone = input.phone?.trim();
    const normalizedPhone = presentedPhone
      ? normalizeBrazilianPhoneToE164(presentedPhone)
      : null;

    if (input.phone != null && normalizedPhone === null) {
      throw new BadRequestException({
        code: "INVALID_BRAZILIAN_PHONE",
        message: "Informe um telefone brasileiro válido com DDD.",
      });
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            emailNormalized: normalizedEmail,
          },
          ...(normalizedPhone
            ? [
              {
                phoneNormalized: normalizedPhone,
              },
            ]
            : []),
        ],
        deletedAt: null,
      },
      select: {
        emailNormalized: true,
        phoneNormalized: true,
      },
    });

    if (existingUser?.emailNormalized === normalizedEmail) {
      throw new EmailAlreadyInUseException();
    }

    if (
      normalizedPhone &&
      existingUser?.phoneNormalized === normalizedPhone
    ) {
      throw new PhoneAlreadyInUseException();
    }

    const passwordHash = await hashPassword(input.password, {
      type: argon2id,
    });

    let createdUserId: string;

    try {
      createdUserId = await this.prisma.$transaction(
        async (transaction) => {
          const professionalCategories =
            input.initialRole === Role.PROFESSIONAL
              ? await this.findActiveCategoriesBySlug(
                  transaction,
                  professionalCategorySlugs,
                )
              : [];

          const user = await transaction.user.create({
            data: {
              name: input.name.trim(),
              email: input.email.trim(),
              emailNormalized: normalizedEmail,
              passwordHash,
              phone: presentedPhone || null,
              phoneNormalized: normalizedPhone,
              phoneVerifiedAt: null,
              status: UserStatus.PENDING,
              roles: {
                create: {
                  role: input.initialRole,
                },
              },
              legalAcceptances: {
                create: [
                  {
                    documentType:
                      LegalDocumentType.TERMS_OF_USE,
                    documentVersion:
                      input.acceptedTermsVersion.trim(),
                  },
                  {
                    documentType:
                      LegalDocumentType.PRIVACY_POLICY,
                    documentVersion:
                      input.acceptedPrivacyPolicyVersion.trim(),
                  },
                ],
              },
            },
            select: {
              id: true,
            },
          });

          if (input.initialRole === Role.CUSTOMER) {
            await transaction.customerProfile.create({
              data: {
                userId: user.id,
              },
            });
          }

          if (input.initialRole === Role.PROFESSIONAL) {
            const professionalProfile =
              await transaction.professionalProfile.create({
              data: {
                userId: user.id,
                displayName: input.name.trim(),
              },
            });

            await transaction.professionalCategory.createMany({
              data: professionalCategories.map(
                (category) => ({
                  professionalProfileId:
                    professionalProfile.id,
                  categoryId: category.id,
                }),
              ),
            });
          }

          return user.id;
        },
      );
    } catch (error: unknown) {
      this.handleUniqueConstraintError(error);
      throw error;
    }

    const safeUser =
      await this.usersService.findSafeById(createdUserId);

    return new RegisterResponseDto(safeUser);
  }

  async login(
    input: LoginUserDto,
  ): Promise<LoginResponseDto> {
    return (await this.loginWithSession(input)).response;
  }

  async loginWithSession(
    input: LoginUserDto,
  ): Promise<LoginSessionResult> {
    const normalizedEmail = this.normalizeEmail(input.email);

    const user = await this.prisma.user.findFirst({
      where: {
        emailNormalized: normalizedEmail,
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

    if (!user) {
      throw new InvalidCredentialsException();
    }

    const passwordMatches = await verifyPassword(
      user.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new InvalidCredentialsException();
    }

    this.ensureLoginAllowed(user.status);

    const sessionId = randomUUID();
    const createdAt = new Date();

    const roles = user.roles.map(
      (userRole) => userRole.role,
    );

    const tokens =
      await this.authTokensService.createTokens({
        userId: user.id,
        sessionId,
        roles,
      });

    const expiresAt = capAuthSessionExpiresAt(
      tokens.refreshTokenExpiresAt,
      getAuthSessionAbsoluteExpiresAt(createdAt),
    );

    await this.prisma.$transaction([
      this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: tokens.refreshTokenHash,
          createdAt,
          expiresAt,
        },
      }),
      this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      }),
    ]);

    const safeUser =
      await this.usersService.findSafeById(user.id);

    return {
      response: new LoginResponseDto({
        user: safeUser,
        accessToken: tokens.accessToken,
        accessTokenExpiresIn:
          tokens.accessTokenExpiresIn,
      }),
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async refresh(
    input: RefreshTokenDto,
  ): Promise<RefreshResponseDto> {
    return (await this.refreshWithSession(input)).response;
  }

  async refreshWithSession(
    input: RefreshTokenDto,
  ): Promise<RefreshSessionResult> {
    const refreshToken = input.refreshToken;

    if (!refreshToken) {
      throw new InvalidRefreshTokenException();
    }

    const refreshTokenHash =
      this.authTokensService.hashRefreshToken(
        refreshToken,
      );

    const session =
      await this.prisma.authSession.findUnique({
        where: {
          refreshTokenHash,
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
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

    const now = new Date();

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.deletedAt !== null
    ) {
      throw new InvalidRefreshTokenException();
    }

    const absoluteExpiresAt = getAuthSessionAbsoluteExpiresAt(session.createdAt);

    if (absoluteExpiresAt <= now) {
      throw new InvalidRefreshTokenException();
    }

    this.ensureLoginAllowed(session.user.status);

    const roles = session.user.roles.map(
      (userRole) => userRole.role,
    );

    const tokens =
      await this.authTokensService.createTokens({
        userId: session.userId,
        sessionId: session.id,
        roles,
      });

    const expiresAt = capAuthSessionExpiresAt(
      tokens.refreshTokenExpiresAt,
      absoluteExpiresAt,
    );

    const rotationResult =
      await this.prisma.authSession.updateMany({
        where: {
          id: session.id,
          refreshTokenHash,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          refreshTokenHash:
            tokens.refreshTokenHash,
          expiresAt,
          lastUsedAt: now,
        },
      });

    if (rotationResult.count !== 1) {
      throw new InvalidRefreshTokenException();
    }

    return {
      response: new RefreshResponseDto({
        accessToken: tokens.accessToken,
        accessTokenExpiresIn:
          tokens.accessTokenExpiresIn,
      }),
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async logout(
    input: RefreshTokenDto,
  ): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    const refreshTokenHash =
      this.authTokensService.hashRefreshToken(
        input.refreshToken,
      );

    const now = new Date();

    await this.prisma.authSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });
  }

  private ensurePublicRegistrationRole(role: Role): void {
    if (!PUBLIC_REGISTRATION_ROLES.includes(role)) {
      throw new BadRequestException({
        code: "INVALID_INITIAL_ROLE",
        message:
          "O papel inicial deve ser CUSTOMER ou PROFESSIONAL.",
      });
    }
  }

  private ensureLoginAllowed(status: UserStatus): void {
    if (!LOGIN_ALLOWED_STATUSES.includes(status)) {
      throw new AccountUnavailableException();
    }
  }

  private validateProfessionalCategorySlugs(
    categorySlugs: string[] | undefined,
  ): string[] {
    if (!categorySlugs || categorySlugs.length === 0) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY_SLUGS",
        message:
          "Selecione de 1 a 3 categorias válidas.",
      });
    }

    const normalizedCategorySlugs = categorySlugs.map(
      (categorySlug) => categorySlug.trim(),
    );

    if (
      normalizedCategorySlugs.some(
        (categorySlug) => categorySlug.length === 0,
      )
    ) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY_SLUGS",
        message:
          "Selecione de 1 a 3 categorias válidas.",
      });
    }

    if (
      normalizedCategorySlugs.length > 3 ||
      new Set(normalizedCategorySlugs).size !==
        normalizedCategorySlugs.length
    ) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY_SLUGS",
        message:
          "Selecione de 1 a 3 categorias válidas.",
      });
    }

    return normalizedCategorySlugs;
  }

  private async findActiveCategoriesBySlug(
    transaction: Prisma.TransactionClient,
    categorySlugs: string[],
  ): Promise<Array<{ id: string; slug: string }>> {
    const categories = await transaction.category.findMany({
      where: {
        slug: {
          in: categorySlugs,
        },
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    if (categories.length !== categorySlugs.length) {
      throw new BadRequestException({
        code: "INVALID_CATEGORY_SLUGS",
        message:
          "Selecione de 1 a 3 categorias válidas.",
      });
    }

    return categories;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private handleUniqueConstraintError(
    error: unknown,
  ): void {
    if (!this.isUniqueConstraintError(error)) {
      return;
    }

    const target = this.getUniqueConstraintTarget(error);

    if (target.includes("phone_normalized")) {
      throw new PhoneAlreadyInUseException();
    }

    throw new EmailAlreadyInUseException();
  }

  private getUniqueConstraintTarget(
    error: Prisma.PrismaClientKnownRequestError,
  ): string[] {
    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.filter(
        (value): value is string =>
          typeof value === "string",
      );
    }

    if (typeof target === "string") {
      return [target];
    }

    return [];
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof
      Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
