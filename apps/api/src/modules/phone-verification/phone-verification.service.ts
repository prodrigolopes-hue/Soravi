import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, UserStatus } from "../../generated/prisma/client";
import { InvalidPhoneVerificationCodeException } from "./errors/invalid-phone-verification-code.exception";
import { PhoneVerificationCodeService } from "./phone-verification-code.service";

interface LockedPhoneVerificationUser {
  id: string;
  status: UserStatus;
  deletedAt: Date | null;
  phoneNormalized: string | null;
  phoneVerifiedAt: Date | null;
}

interface LockedPhoneVerificationChallenge {
  id: string;
  userId: string;
  phoneNormalized: string;
  codeHash: string;
  expiresAt: Date;
  attemptCount: number;
  maxAttempts: number;
}

const ELIGIBLE_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

@Injectable()
export class PhoneVerificationService {
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly cooldownSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeService: PhoneVerificationCodeService,
    configService: ConfigService,
  ) {
    this.ttlSeconds = configService.get<number>(
      "PHONE_VERIFICATION_TTL_SECONDS",
      600,
    );
    this.maxAttempts = configService.get<number>(
      "PHONE_VERIFICATION_MAX_ATTEMPTS",
      5,
    );
    this.cooldownSeconds = configService.get<number>(
      "PHONE_VERIFICATION_COOLDOWN_SECONDS",
      60,
    );
  }

  async requestChallenge(userId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const user = await this.lockUser(transaction, userId);

      if (!this.isEligibleForRequest(user)) {
        return;
      }

      const latestChallenge =
        await transaction.phoneVerificationChallenge.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
      const now = new Date();
      const cooldownStartedAt = new Date(
        now.getTime() - this.cooldownSeconds * 1_000,
      );

      if (
        latestChallenge &&
        latestChallenge.createdAt > cooldownStartedAt
      ) {
        return;
      }

      await transaction.phoneVerificationChallenge.updateMany({
        where: {
          userId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      });

      const challengeId = randomUUID();
      const code = this.codeService.generateCode();
      const codeHash = this.codeService.hashCode({
        challengeId,
        userId,
        phoneNormalized: user.phoneNormalized,
        code,
      });

      await transaction.phoneVerificationChallenge.create({
        data: {
          id: challengeId,
          userId,
          phoneNormalized: user.phoneNormalized,
          codeHash,
          expiresAt: new Date(now.getTime() + this.ttlSeconds * 1_000),
          attemptCount: 0,
          maxAttempts: this.maxAttempts,
          consumedAt: null,
          invalidatedAt: null,
        },
      });
    });
  }

  async confirmCode(userId: string, code: string): Promise<void> {
    const confirmed = await this.prisma.$transaction(async (transaction) => {
      const challenge = await this.lockLatestActiveChallenge(
        transaction,
        userId,
      );

      if (!challenge) {
        return false;
      }

      const now = new Date();
      const user = await this.lockUser(transaction, userId);

      if (!this.isEligibleForConfirmation(user, challenge)) {
        await this.invalidateChallenge(transaction, challenge.id, now);
        return false;
      }

      if (
        challenge.expiresAt <= now ||
        challenge.attemptCount >= challenge.maxAttempts
      ) {
        await this.invalidateChallenge(transaction, challenge.id, now);
        return false;
      }

      const codeMatches = this.codeService.verifyCode({
        challengeId: challenge.id,
        userId,
        phoneNormalized: challenge.phoneNormalized,
        code,
        expectedHash: challenge.codeHash,
      });

      if (!codeMatches) {
        const nextAttemptCount = challenge.attemptCount + 1;

        await transaction.phoneVerificationChallenge.update({
          where: { id: challenge.id },
          data: {
            attemptCount: { increment: 1 },
            ...(nextAttemptCount >= challenge.maxAttempts
              ? { invalidatedAt: now }
              : {}),
          },
        });
        return false;
      }

      await transaction.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: now },
      });
      await transaction.phoneVerificationChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });

      return true;
    });

    if (!confirmed) {
      throw new InvalidPhoneVerificationCodeException();
    }
  }

  private async lockUser(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedPhoneVerificationUser | null> {
    const [user] = await transaction.$queryRaw<
      LockedPhoneVerificationUser[]
    >(Prisma.sql`
      SELECT
        "id",
        "status",
        "deleted_at" AS "deletedAt",
        "phone_normalized" AS "phoneNormalized",
        "phone_verified_at" AS "phoneVerifiedAt"
      FROM "users"
      WHERE "id" = ${userId}::uuid
      FOR UPDATE
    `);

    return user ?? null;
  }

  private async lockLatestActiveChallenge(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedPhoneVerificationChallenge | null> {
    const [challenge] = await transaction.$queryRaw<
      LockedPhoneVerificationChallenge[]
    >(Prisma.sql`
      SELECT
        "id",
        "user_id" AS "userId",
        "phone_normalized" AS "phoneNormalized",
        "code_hash" AS "codeHash",
        "expires_at" AS "expiresAt",
        "attempt_count" AS "attemptCount",
        "max_attempts" AS "maxAttempts"
      FROM "phone_verification_challenges"
      WHERE "user_id" = ${userId}::uuid
        AND "consumed_at" IS NULL
        AND "invalidated_at" IS NULL
      ORDER BY "created_at" DESC
      LIMIT 1
      FOR UPDATE
    `);

    return challenge ?? null;
  }

  private isEligibleForRequest(
    user: LockedPhoneVerificationUser | null,
  ): user is LockedPhoneVerificationUser & { phoneNormalized: string } {
    return (
      user !== null &&
      user.deletedAt === null &&
      ELIGIBLE_USER_STATUSES.includes(user.status) &&
      user.phoneNormalized !== null &&
      user.phoneVerifiedAt === null
    );
  }

  private isEligibleForConfirmation(
    user: LockedPhoneVerificationUser | null,
    challenge: LockedPhoneVerificationChallenge,
  ): user is LockedPhoneVerificationUser & { phoneNormalized: string } {
    return (
      user !== null &&
      user.deletedAt === null &&
      ELIGIBLE_USER_STATUSES.includes(user.status) &&
      user.phoneNormalized !== null &&
      user.phoneNormalized === challenge.phoneNormalized &&
      user.phoneVerifiedAt === null
    );
  }

  private async invalidateChallenge(
    transaction: Prisma.TransactionClient,
    challengeId: string,
    now: Date,
  ): Promise<void> {
    await transaction.phoneVerificationChallenge.update({
      where: { id: challengeId },
      data: { invalidatedAt: now },
    });
  }
}
