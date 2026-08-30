import { Injectable } from "@nestjs/common";
import { verify as verifyPassword } from "argon2";

import { normalizeBrazilianPhoneToE164 } from "../../common/phone/brazilian-phone";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { PhoneAlreadyInUseException } from "../auth/errors/phone-already-in-use.exception";
import { UpdateCurrentUserPhoneDto } from "./dto/update-current-user-phone.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { InvalidBrazilianPhoneException } from "./errors/invalid-brazilian-phone.exception";
import { InvalidCurrentPasswordException } from "./errors/invalid-current-password.exception";
import { UserNotFoundException } from "./errors/user-not-found.exception";
import { UsersService } from "./users.service";

interface LockedUserPhoneData {
  id: string;
  passwordHash: string;
  phone: string | null;
  phoneNormalized: string | null;
  phoneVerifiedAt: Date | null;
}

@Injectable()
export class UsersPhoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async updateCurrentUserPhone(
    userId: string,
    currentSessionId: string,
    input: UpdateCurrentUserPhoneDto,
  ): Promise<UserResponseDto> {
    const phoneNormalized = normalizeBrazilianPhoneToE164(input.phone);

    if (phoneNormalized === null) {
      throw new InvalidBrazilianPhoneException();
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const user = await this.lockUser(transaction, userId);

        if (user === null) {
          throw new UserNotFoundException();
        }

        const passwordMatches = await verifyPassword(
          user.passwordHash,
          input.currentPassword,
        );

        if (!passwordMatches) {
          throw new InvalidCurrentPasswordException();
        }

        if (user.phoneNormalized === phoneNormalized) {
          if (user.phone !== input.phone) {
            await transaction.user.update({
              where: { id: userId },
              data: { phone: input.phone },
            });
          }

          return;
        }

        const duplicate = await transaction.user.findFirst({
          where: {
            id: { not: userId },
            phoneNormalized,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (duplicate !== null) {
          throw new PhoneAlreadyInUseException();
        }

        const now = new Date();

        await transaction.user.update({
          where: { id: userId },
          data: {
            phone: input.phone,
            phoneNormalized,
            phoneVerifiedAt: null,
          },
        });
        await transaction.phoneVerificationChallenge.updateMany({
          where: { userId, consumedAt: null, invalidatedAt: null },
          data: { invalidatedAt: now },
        });
        await transaction.authSession.updateMany({
          where: {
            userId,
            id: { not: currentSessionId },
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new PhoneAlreadyInUseException();
      }

      throw error;
    }

    return this.usersService.findSafeById(userId);
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedUserPhoneData | null> {
    const [user] = await transaction.$queryRaw<LockedUserPhoneData[]>(
      Prisma.sql`
        SELECT
          "id",
          "password_hash" AS "passwordHash",
          "phone",
          "phone_normalized" AS "phoneNormalized",
          "phone_verified_at" AS "phoneVerifiedAt"
        FROM "users"
        WHERE "id" = ${userId}::uuid
          AND "deleted_at" IS NULL
        FOR UPDATE
      `,
    );

    return user ?? null;
  }
}
