import { Injectable } from "@nestjs/common";

import { Prisma, ProfessionalVerificationStatus, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PublicProfessionalDiscoveryQueryDto } from "./dto/public-professional-discovery-query.dto";
import {
  PublicProfessionalListResponseDto,
  type PublicProfessionalListItemProperties,
} from "./dto/public-professional-list-response.dto";
import { PublicProfessionalProfileResponseDto } from "./dto/public-professional-profile-response.dto";
import { PublicCategoryNotFoundException } from "./errors/public-category-not-found.exception";
import { PublicProfessionalNotFoundException } from "./errors/public-professional-not-found.exception";
import { ProfessionalProfilePhotoReadService } from "../users/professional-profile-photo-read.service";

const publicProfessionalSelect = {
  id: true,
  displayName: true,
  professionalTitle: true,
  serviceArea: true,
  bio: true,
  professionalCategories: {
    where: { category: { isActive: true } },
    select: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { category: { name: "asc" } },
  },
  photo: {
    select: { objectKey: true },
  },
} satisfies Prisma.ProfessionalProfileSelect;

type PublicProfessionalRecord = Prisma.ProfessionalProfileGetPayload<{
  select: typeof publicProfessionalSelect;
}>;

@Injectable()
export class ProfessionalDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionalProfilePhotoReadService: ProfessionalProfilePhotoReadService,
  ) {}

  async findByCategory(
    categorySlug: string,
    query: PublicProfessionalDiscoveryQueryDto,
  ): Promise<PublicProfessionalListResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: { slug: categorySlug, isActive: true },
      select: { id: true },
    });
    if (!category) {
      throw new PublicCategoryNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.eligibleProfessionalsWhere({
      categoryId: category.id,
    });
    const [total, professionals] = await this.prisma.$transaction([
      this.prisma.professionalProfile.count({ where }),
      this.prisma.professionalProfile.findMany({
        where,
        orderBy: [{ displayName: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: publicProfessionalSelect,
      }),
    ]);

    const reputations = await this.findPublicReputations(
      professionals.map((professional) => professional.id),
    );
    return new PublicProfessionalListResponseDto(
      await Promise.all(
        professionals.map((professional) => this.toListItem(professional, reputations)),
      ),
      page,
      limit,
      total,
    );
  }

  async findOne(
    professionalProfileId: string,
    query: PublicProfessionalDiscoveryQueryDto,
  ): Promise<PublicProfessionalProfileResponseDto> {
    const professional = await this.prisma.professionalProfile.findFirst({
      where: {
        id: professionalProfileId,
        ...this.eligibleProfessionalsWhere(),
      },
      select: publicProfessionalSelect,
    });
    if (!professional) {
      throw new PublicProfessionalNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const reviewWhere: Prisma.ReviewWhereInput = {
      professionalProfileId: professional.id,
      publishedAt: { not: null },
    };
    const [reviewsTotal, reviews, reputation] = await Promise.all([
      this.prisma.review.count({ where: reviewWhere }),
      this.prisma.review.findMany({
        where: reviewWhere,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: { rating: true, comment: true, publishedAt: true },
      }),
      this.prisma.review.aggregate({
        where: reviewWhere,
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    return new PublicProfessionalProfileResponseDto({
      id: professional.id,
      displayName: professional.displayName,
      professionalTitle: professional.professionalTitle,
      serviceArea: professional.serviceArea,
      bio: professional.bio,
      categories: professional.professionalCategories.map(({ category }) => category),
      reputation: {
        averageRating: Number(reputation._avg.rating ?? 0),
        reviewCount: reputation._count._all,
      },
      reviews: reviews.map((review) => ({
        rating: review.rating,
        comment: review.comment,
        publishedAt: review.publishedAt!,
      })),
      reviewsPage: page,
      reviewsLimit: limit,
      reviewsTotal,
      photo: await this.professionalProfilePhotoReadService.createTemporaryReadUrl(
        professional.photo?.objectKey,
      ),
    });
  }

  private eligibleProfessionalsWhere(input: { categoryId?: string } = {}): Prisma.ProfessionalProfileWhereInput {
    return {
      deletedAt: null,
      verificationStatus: ProfessionalVerificationStatus.APPROVED,
      isAvailable: true,
      user: { deletedAt: null, status: UserStatus.ACTIVE },
      professionalCategories: {
        some: input.categoryId
          ? { categoryId: input.categoryId, category: { isActive: true } }
          : { category: { isActive: true } },
      },
    };
  }

  private async findPublicReputations(profileIds: string[]): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    if (profileIds.length === 0) {
      return new Map();
    }
    const summaries = await this.prisma.review.groupBy({
      by: ["professionalProfileId"],
      where: {
        professionalProfileId: { in: profileIds },
        publishedAt: { not: null },
      },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return new Map(summaries.map((summary) => [
      summary.professionalProfileId,
      {
        averageRating: Number(summary._avg.rating ?? 0),
        reviewCount: summary._count._all,
      },
    ]));
  }

  private async toListItem(
    professional: PublicProfessionalRecord,
    reputations: Map<string, { averageRating: number; reviewCount: number }>,
  ): Promise<PublicProfessionalListItemProperties> {
    return {
      id: professional.id,
      displayName: professional.displayName,
      professionalTitle: professional.professionalTitle,
      serviceArea: professional.serviceArea,
      categories: professional.professionalCategories.map(({ category }) => category),
      reputation: reputations.get(professional.id) ?? {
        averageRating: 0,
        reviewCount: 0,
      },
      photo: await this.professionalProfilePhotoReadService.createTemporaryReadUrl(
        professional.photo?.objectKey,
      ),
    };
  }
}
