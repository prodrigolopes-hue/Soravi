import { Injectable } from "@nestjs/common";
import {
  argon2id,
  hash as hashPassword,
  verify as verifyPassword,
} from "argon2";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ensurePasswordIsAllowed } from "../auth/password-policy/password-policy";
import { UpdateCurrentUserPasswordDto } from "./dto/update-current-user-password.dto";
import { InvalidCurrentPasswordException } from "./errors/invalid-current-password.exception";
import { NewPasswordMustDifferException } from "./errors/new-password-must-differ.exception";
import { UserNotFoundException } from "./errors/user-not-found.exception";

interface LockedUserPasswordData {
  id: string;
  passwordHash: string;
}

@Injectable()
export class UsersPasswordService {
  constructor(private readonly prisma: PrismaService) {}

  async updateCurrentUserPassword(
    userId: string,
    currentSessionId: string,
    input: UpdateCurrentUserPasswordDto,
  ): Promise<void> {
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

      if (input.newPassword === input.currentPassword) {
        throw new NewPasswordMustDifferException();
      }

      ensurePasswordIsAllowed(input.newPassword);

      const passwordHash = await hashPassword(input.newPassword, {
        type: argon2id,
      });
      const now = new Date();

      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { id: true },
      });
      await transaction.passwordResetToken.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: { usedAt: now },
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
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedUserPasswordData | null> {
    const [user] = await transaction.$queryRaw<LockedUserPasswordData[]>(
      Prisma.sql`
        SELECT
          "id",
          "password_hash" AS "passwordHash"
        FROM "users"
        WHERE "id" = ${userId}::uuid
          AND "deleted_at" IS NULL
        FOR UPDATE
      `,
    );

    return user ?? null;
  }
}