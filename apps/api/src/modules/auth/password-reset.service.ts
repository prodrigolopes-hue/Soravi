import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { argon2id, hash as hashPassword } from "argon2";

import { PrismaService } from "../../database/prisma.service";
import {
  Prisma,
  UserStatus,
} from "../../generated/prisma/client";
import { PasswordResetInvalidOrExpiredException } from "./errors/password-reset-invalid-or-expired.exception";
import { ensurePasswordIsAllowed } from "./password-policy/password-policy";
import {
  PASSWORD_RESET_DELIVERY_PORT,
  PasswordResetDeliveryPort,
  SendPasswordResetInput,
} from "./password-reset-delivery.port";

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1_000;
const ELIGIBLE_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

interface LockedPasswordResetUser {
  id: string;
  email: string;
  status: UserStatus;
  deletedAt: Date | null;
}

interface LockedPasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

interface PasswordResetDeliveryData extends SendPasswordResetInput {
  tokenId: string;
  userId: string;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_RESET_DELIVERY_PORT)
    private readonly deliveryPort: PasswordResetDeliveryPort,
  ) {}

  async requestReset(emailNormalized: string): Promise<void> {
    const candidate = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    if (candidate === null) {
      return;
    }

    const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString(
      "base64url",
    );
    const tokenHash = this.hashToken(rawToken);

    const deliveryData = await this.prisma.$transaction<
      PasswordResetDeliveryData | null
    >(async (transaction) => {
      const user = await this.lockUser(transaction, candidate.id);

      if (!this.isEligibleUser(user)) {
        return null;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

      await transaction.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      const token = await transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          usedAt: null,
        },
        select: { id: true },
      });

      return {
        tokenId: token.id,
        userId: user.id,
        email: user.email,
        rawToken,
        expiresAt,
      };
    });

    if (deliveryData === null) {
      return;
    }

    try {
      await this.deliveryPort.sendReset({
        email: deliveryData.email,
        rawToken: deliveryData.rawToken,
        expiresAt: deliveryData.expiresAt,
      });
    } catch {
      await this.prisma.passwordResetToken
        .updateMany({
          where: {
            id: deliveryData.tokenId,
            userId: deliveryData.userId,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        })
        .catch(() => undefined);
    }
  }

  async confirmReset(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const candidate = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });

    if (candidate === null) {
      throw new PasswordResetInvalidOrExpiredException();
    }

    await this.prisma.$transaction(async (transaction) => {
      const user = await this.lockUser(transaction, candidate.userId);
      const token = await this.lockToken(transaction, candidate.id);
      const now = new Date();

      if (
        !this.isEligibleUser(user) ||
        token === null ||
        token.userId !== candidate.userId ||
        token.usedAt !== null ||
        token.expiresAt <= now ||
        !this.tokenHashesMatch(token.tokenHash, tokenHash)
      ) {
        throw new PasswordResetInvalidOrExpiredException();
      }

      ensurePasswordIsAllowed(newPassword);

      const passwordHash = await hashPassword(newPassword, {
        type: argon2id,
      });

      await transaction.user.update({
        where: { id: user.id },
        data: { passwordHash },
        select: { id: true },
      });
      await transaction.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now },
        select: { id: true },
      });
      await transaction.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          id: { not: token.id },
          usedAt: null,
        },
        data: { usedAt: now },
      });
      await transaction.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  private hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }

  private tokenHashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedPasswordResetUser | null> {
    const [user] = await transaction.$queryRaw<LockedPasswordResetUser[]>(
      Prisma.sql`
        SELECT "id", "email", "status", "deleted_at" AS "deletedAt"
        FROM "users"
        WHERE "id" = ${userId}::uuid
        FOR UPDATE
      `,
    );

    return user ?? null;
  }

  private async lockToken(
    transaction: Prisma.TransactionClient,
    tokenId: string,
  ): Promise<LockedPasswordResetToken | null> {
    const [token] = await transaction.$queryRaw<LockedPasswordResetToken[]>(
      Prisma.sql`
        SELECT
          "id",
          "user_id" AS "userId",
          "token_hash" AS "tokenHash",
          "expires_at" AS "expiresAt",
          "used_at" AS "usedAt"
        FROM "password_reset_tokens"
        WHERE "id" = ${tokenId}::uuid
        FOR UPDATE
      `,
    );

    return token ?? null;
  }

  private isEligibleUser(
    user: LockedPasswordResetUser | null,
  ): user is LockedPasswordResetUser {
    return (
      user !== null &&
      user.deletedAt === null &&
      ELIGIBLE_USER_STATUSES.includes(user.status)
    );
  }
}
