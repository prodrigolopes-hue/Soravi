import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, UserStatus } from "../../generated/prisma/client";
import {
  EMAIL_VERIFICATION_DELIVERY_PORT,
  EmailVerificationDeliveryPort,
  SendEmailVerificationInput,
} from "./email-verification-delivery.port";
import { EmailVerificationInvalidOrExpiredException } from "./errors/email-verification-invalid-or-expired.exception";

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1_000;
const ELIGIBLE_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

interface LockedUser {
  id: string;
  email: string;
  status: UserStatus;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
}

interface LockedToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

interface DeliveryData extends SendEmailVerificationInput {
  tokenId: string;
  userId: string;
}

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_VERIFICATION_DELIVERY_PORT)
    private readonly deliveryPort: EmailVerificationDeliveryPort,
  ) {}

  async sendForRegisteredUser(userId: string): Promise<void> {
    await this.sendForUserId(userId);
  }

  async requestVerification(emailNormalized: string): Promise<void> {
    const candidate = await this.prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });

    if (candidate !== null) {
      await this.sendForUserId(candidate.id);
    }
  }

  async confirm(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const candidate = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });

    if (candidate === null) {
      throw new EmailVerificationInvalidOrExpiredException();
    }

    await this.prisma.$transaction(async (transaction) => {
      const user = await this.lockUser(transaction, candidate.userId);
      const token = await this.lockToken(transaction, candidate.id);
      const now = new Date();

      if (
        !this.isEligibleUser(user) ||
        user.emailVerifiedAt !== null ||
        token === null ||
        token.userId !== candidate.userId ||
        token.usedAt !== null ||
        token.expiresAt <= now ||
        !this.tokenHashesMatch(token.tokenHash, tokenHash)
      ) {
        throw new EmailVerificationInvalidOrExpiredException();
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: now },
        select: { id: true },
      });
      await transaction.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now },
        select: { id: true },
      });
      await transaction.emailVerificationToken.updateMany({
        where: { userId: user.id, id: { not: token.id }, usedAt: null },
        data: { usedAt: now },
      });
    });
  }

  private async sendForUserId(userId: string): Promise<void> {
    const rawToken = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString(
      "base64url",
    );
    const tokenHash = this.hashToken(rawToken);
    const delivery = await this.prisma.$transaction<DeliveryData | null>(
      async (transaction) => {
        const user = await this.lockUser(transaction, userId);
        if (!this.isEligibleUser(user) || user.emailVerifiedAt !== null) {
          return null;
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);
        await transaction.emailVerificationToken.updateMany({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        const token = await transaction.emailVerificationToken.create({
          data: { userId: user.id, tokenHash, expiresAt },
          select: { id: true },
        });

        return {
          tokenId: token.id,
          userId: user.id,
          email: user.email,
          rawToken,
          expiresAt,
        };
      },
    );

    if (delivery === null) {
      return;
    }

    try {
      await this.deliveryPort.sendVerification(delivery);
    } catch {
      await this.prisma.emailVerificationToken
        .updateMany({
          where: { id: delivery.tokenId, userId: delivery.userId, usedAt: null },
          data: { usedAt: new Date() },
        })
        .catch(() => undefined);
    }
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
  ): Promise<LockedUser | null> {
    const [user] = await transaction.$queryRaw<LockedUser[]>(Prisma.sql`
      SELECT "id", "email", "status", "deleted_at" AS "deletedAt",
             "email_verified_at" AS "emailVerifiedAt"
      FROM "users"
      WHERE "id" = ${userId}::uuid
      FOR UPDATE
    `);
    return user ?? null;
  }

  private async lockToken(
    transaction: Prisma.TransactionClient,
    tokenId: string,
  ): Promise<LockedToken | null> {
    const [token] = await transaction.$queryRaw<LockedToken[]>(Prisma.sql`
      SELECT "id", "user_id" AS "userId", "token_hash" AS "tokenHash",
             "expires_at" AS "expiresAt", "used_at" AS "usedAt"
      FROM "email_verification_tokens"
      WHERE "id" = ${tokenId}::uuid
      FOR UPDATE
    `);
    return token ?? null;
  }

  private isEligibleUser(user: LockedUser | null): user is LockedUser {
    return (
      user !== null &&
      user.deletedAt === null &&
      ELIGIBLE_USER_STATUSES.includes(user.status)
    );
  }
}
