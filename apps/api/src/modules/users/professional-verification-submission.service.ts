import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  Prisma,
  ProfessionalVerificationStatus,
} from "../../generated/prisma/client";
import { ProfessionalVerificationSubmissionResponseDto } from "./dto/professional-verification-submission-response.dto";
import { ProfessionalVerificationProfileNotFoundException } from "./errors/professional-verification-profile-not-found.exception";
import {
  ProfessionalVerificationSubmissionNotEligibleException,
} from "./errors/professional-verification-submission-not-eligible.exception";
import { ProfessionalVerificationStatusTransitionNotAllowedException } from "./errors/professional-verification-status-transition-not-allowed.exception";

interface LockedProfessionalProfile {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  bio: string | null;
  verificationStatus: ProfessionalVerificationStatus;
  phone: string | null;
  phoneVerifiedAt: Date | null;
}

@Injectable()
export class ProfessionalVerificationSubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(
    userId: string,
  ): Promise<ProfessionalVerificationSubmissionResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const profile = await this.lockProfessionalProfile(transaction, userId);

      if (!profile) {
        throw new ProfessionalVerificationProfileNotFoundException();
      }

      const isResubmission = profile.verificationStatus === ProfessionalVerificationStatus.REJECTED;
      if (profile.verificationStatus !== ProfessionalVerificationStatus.NOT_STARTED && !isResubmission) {
        throw new ProfessionalVerificationStatusTransitionNotAllowedException();
      }

      if (profile.displayName.trim().length === 0) {
        throw new ProfessionalVerificationSubmissionNotEligibleException(
          "DISPLAY_NAME_MISSING",
        );
      }

      if (!profile.phone) {
        throw new ProfessionalVerificationSubmissionNotEligibleException(
          "PHONE_MISSING",
        );
      }

      if (!profile.phoneVerifiedAt) {
        throw new ProfessionalVerificationSubmissionNotEligibleException(
          "PHONE_NOT_VERIFIED",
        );
      }

      const activeCategoryCount = await transaction.professionalCategory.count({
        where: {
          professionalProfileId: profile.id,
          category: { isActive: true },
        },
      });

      if (activeCategoryCount === 0) {
        throw new ProfessionalVerificationSubmissionNotEligibleException(
          "ACTIVE_CATEGORY_MISSING",
        );
      }

      if (isResubmission && !profile.professionalTitle?.trim()) {
        throw new ProfessionalVerificationSubmissionNotEligibleException("PROFESSIONAL_TITLE_MISSING");
      }
      if (isResubmission && !profile.serviceArea?.trim()) {
        throw new ProfessionalVerificationSubmissionNotEligibleException("SERVICE_AREA_MISSING");
      }
      if (isResubmission && (!profile.bio || profile.bio.trim().length < 30)) {
        throw new ProfessionalVerificationSubmissionNotEligibleException("BIO_TOO_SHORT");
      }

      const result = await transaction.professionalProfile.updateMany({
        where: {
          id: profile.id,
          verificationStatus: isResubmission ? ProfessionalVerificationStatus.REJECTED : ProfessionalVerificationStatus.NOT_STARTED,
        },
        data: {
          verificationStatus: ProfessionalVerificationStatus.PENDING,
          ...(isResubmission ? { reviewedAt: null, reviewedByUserId: null, reviewNotes: null } : {}),
        },
      });

      if (result.count !== 1) {
        throw new ProfessionalVerificationStatusTransitionNotAllowedException();
      }

      return new ProfessionalVerificationSubmissionResponseDto(
        ProfessionalVerificationStatus.PENDING,
      );
    });
  }

  private async lockProfessionalProfile(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<LockedProfessionalProfile | null> {
    const [profile] = await transaction.$queryRaw<LockedProfessionalProfile[]>(
      Prisma.sql`
        SELECT
          "professional_profiles"."id",
          "professional_profiles"."display_name" AS "displayName",
          "professional_profiles"."professional_title" AS "professionalTitle",
          "professional_profiles"."service_area" AS "serviceArea",
          "professional_profiles"."bio",
          "professional_profiles"."verification_status" AS "verificationStatus",
          "users"."phone",
          "users"."phone_verified_at" AS "phoneVerifiedAt"
        FROM "professional_profiles"
        INNER JOIN "users" ON "users"."id" = "professional_profiles"."user_id"
        WHERE "professional_profiles"."user_id" = ${userId}::uuid
          AND "professional_profiles"."deleted_at" IS NULL
          AND "users"."deleted_at" IS NULL
        FOR UPDATE OF "professional_profiles"
      `,
    );

    return profile ?? null;
  }
}
