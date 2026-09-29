import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ProfessionalProfileResponseDto } from "./dto/professional-profile-response.dto";
import { UpdateCurrentProfessionalProfileDto } from "./dto/update-current-professional-profile.dto";
import { CurrentProfessionalProfileNotFoundException } from "./errors/current-professional-profile-not-found.exception";
import { InvalidProfessionalProfileCategoriesException } from "./errors/invalid-professional-profile-categories.exception";

const professionalProfileSelect = {
  id: true,
  displayName: true,
  professionalTitle: true,
  serviceArea: true,
  bio: true,
  isAvailable: true,
  verificationStatus: true,
  professionalCategories: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      category: {
        name: "asc",
      },
    },
  },
} satisfies Prisma.ProfessionalProfileSelect;

type ProfessionalProfileRecord = Prisma.ProfessionalProfileGetPayload<{
  select: typeof professionalProfileSelect;
}>;

@Injectable()
export class CurrentProfessionalProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(userId: string): Promise<ProfessionalProfileResponseDto> {
    const profile = await this.prisma.professionalProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: professionalProfileSelect,
    });

    if (!profile) {
      throw new CurrentProfessionalProfileNotFoundException();
    }

    return this.toResponse(profile);
  }

  async updateCurrent(
    userId: string,
    input: UpdateCurrentProfessionalProfileDto,
  ): Promise<ProfessionalProfileResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      this.ensureDistinctCategorySlugs(input.categorySlugs);

      const profile = await transaction.professionalProfile.findFirst({
        where: {
          userId,
          deletedAt: null,
          user: { deletedAt: null },
        },
        select: { id: true },
      });

      if (!profile) {
        throw new CurrentProfessionalProfileNotFoundException();
      }

      const categories = await transaction.category.findMany({
        where: {
          slug: { in: input.categorySlugs },
          isActive: true,
        },
        select: { id: true, slug: true },
      });

      if (categories.length !== input.categorySlugs.length) {
        throw new InvalidProfessionalProfileCategoriesException();
      }

      const profileData: Prisma.ProfessionalProfileUpdateInput = {
        displayName: input.displayName,
        isAvailable: input.isAvailable,
      };

      if (input.professionalTitle !== undefined) {
        profileData.professionalTitle = input.professionalTitle;
      }
      if (input.serviceArea !== undefined) {
        profileData.serviceArea = input.serviceArea;
      }
      if (input.bio !== undefined) {
        profileData.bio = input.bio;
      }

      await transaction.professionalProfile.update({
        where: { id: profile.id },
        data: profileData,
      });

      await transaction.professionalCategory.deleteMany({
        where: { professionalProfileId: profile.id },
      });
      await transaction.professionalCategory.createMany({
        data: categories.map((category) => ({
          professionalProfileId: profile.id,
          categoryId: category.id,
        })),
      });

      const updatedProfile = await transaction.professionalProfile.findUnique({
        where: { id: profile.id },
        select: professionalProfileSelect,
      });

      if (!updatedProfile) {
        throw new CurrentProfessionalProfileNotFoundException();
      }

      return this.toResponse(updatedProfile);
    });
  }

  private ensureDistinctCategorySlugs(categorySlugs: string[]): void {
    if (new Set(categorySlugs).size !== categorySlugs.length) {
      throw new InvalidProfessionalProfileCategoriesException();
    }
  }

  private toResponse(profile: ProfessionalProfileRecord): ProfessionalProfileResponseDto {
    return new ProfessionalProfileResponseDto({
      id: profile.id,
      displayName: profile.displayName,
      professionalTitle: profile.professionalTitle,
      serviceArea: profile.serviceArea,
      bio: profile.bio,
      isAvailable: profile.isAvailable,
      verificationStatus: profile.verificationStatus,
      categories: profile.professionalCategories.map(({ category }) => category),
    });
  }
}
