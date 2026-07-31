import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import {
  argon2id,
  hash as hashPassword,
} from "argon2";

import {
  LegalDocumentType,
  Prisma,
  Role,
  UserStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { UsersService } from "../users/users.service";
import { RegisterUserDto } from "./dto/register-user.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";
import { EmailAlreadyInUseException } from "./errors/email-already-in-use.exception";

const PUBLIC_REGISTRATION_ROLES: readonly Role[] = [
  Role.CUSTOMER,
  Role.PROFESSIONAL,
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async register(
    input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    this.ensurePublicRegistrationRole(input.initialRole);

    const normalizedEmail = this.normalizeEmail(input.email);
    const normalizedPhone = this.normalizePhone(input.phone);

    const existingUser = await this.prisma.user.findFirst({
      where: {
        emailNormalized: normalizedEmail,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new EmailAlreadyInUseException();
    }

    const passwordHash = await hashPassword(input.password, {
      type: argon2id,
    });

    let createdUserId: string;

    try {
      createdUserId = await this.prisma.$transaction(
        async (transaction) => {
          const user = await transaction.user.create({
            data: {
              name: input.name.trim(),
              email: input.email.trim(),
              emailNormalized: normalizedEmail,
              passwordHash,
              phone: input.phone?.trim() || null,
              phoneNormalized: normalizedPhone,
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
            await transaction.professionalProfile.create({
              data: {
                userId: user.id,
                displayName: input.name.trim(),
              },
            });
          }

          return user.id;
        },
      );
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new EmailAlreadyInUseException();
      }

      throw error;
    }

    const safeUser =
      await this.usersService.findSafeById(createdUserId);

    return new RegisterResponseDto(safeUser);
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizePhone(
    phone: string | undefined,
  ): string | null {
    if (!phone) {
      return null;
    }

    const digits = phone.replace(/\D/g, "");

    return digits.length > 0 ? digits : null;
  }

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}