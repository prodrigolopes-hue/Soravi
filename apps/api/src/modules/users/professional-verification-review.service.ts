import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma, ProfessionalVerificationStatus, Role } from "../../generated/prisma/client";
import { ProfessionalVerificationReviewResponseDto } from "./dto/professional-verification-review-response.dto";
import { ReviewProfessionalVerificationDto } from "./dto/review-professional-verification.dto";
import { ProfessionalVerificationReviewTargetNotFoundException } from "./errors/professional-verification-review-target-not-found.exception";
import { ProfessionalVerificationReviewTransitionNotAllowedException } from "./errors/professional-verification-review-transition-not-allowed.exception";

interface LockedReviewTarget { id: string; verificationStatus: ProfessionalVerificationStatus; }

@Injectable()
export class ProfessionalVerificationReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async review(adminUserId: string, targetUserId: string, input: ReviewProfessionalVerificationDto): Promise<ProfessionalVerificationReviewResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const target = await this.lockTarget(transaction, targetUserId);
      if (!target) throw new ProfessionalVerificationReviewTargetNotFoundException();
      if (target.verificationStatus !== ProfessionalVerificationStatus.PENDING) throw new ProfessionalVerificationReviewTransitionNotAllowedException();
      const reviewedAt = new Date();
      const reviewNotes = input.reviewNotes ?? null;
      const result = await transaction.professionalProfile.updateMany({ where: { id: target.id, verificationStatus: ProfessionalVerificationStatus.PENDING }, data: { verificationStatus: input.status, reviewNotes, reviewedAt, reviewedByUserId: adminUserId } });
      if (result.count !== 1) throw new ProfessionalVerificationReviewTransitionNotAllowedException();
      return new ProfessionalVerificationReviewResponseDto({ userId: targetUserId, verificationStatus: input.status, reviewedAt, reviewedByUserId: adminUserId, reviewNotes });
    });
  }

  private async lockTarget(transaction: Prisma.TransactionClient, targetUserId: string): Promise<LockedReviewTarget | null> {
    const [target] = await transaction.$queryRaw<LockedReviewTarget[]>(Prisma.sql`
      SELECT "professional_profiles"."id", "professional_profiles"."verification_status" AS "verificationStatus"
      FROM "professional_profiles" INNER JOIN "users" ON "users"."id" = "professional_profiles"."user_id"
      INNER JOIN "user_roles" ON "user_roles"."user_id" = "users"."id" AND "user_roles"."role" = ${Role.PROFESSIONAL}::"Role"
      WHERE "users"."id" = ${targetUserId}::uuid AND "users"."deleted_at" IS NULL AND "professional_profiles"."deleted_at" IS NULL
      FOR UPDATE OF "professional_profiles"
    `);
    return target ?? null;
  }
}
