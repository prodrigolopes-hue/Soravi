import { Injectable } from "@nestjs/common";

import { Prisma, Role } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  OpportunitiesListResponseDto,
  OpportunityListItemProperties,
} from "./dto/opportunities-list-response.dto";
import {
  OpportunityDetailResponseDto,
  OpportunityDetailResponseProperties,
} from "./dto/opportunity-detail-response.dto";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { ProfessionalProfileNotFoundException } from "../category-requests/errors/professional-profile-not-found.exception";
import { OpportunityNotFoundException } from "./errors/opportunity-not-found.exception";

const OPPORTUNITY_SELECT = {
  id: true,
  createdAt: true,
  viewedAt: true,
  serviceRequest: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      state: true,
      city: true,
      neighborhood: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceOpportunitySelect;

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(
    userId: string,
    query: OpportunitiesQueryDto,
  ): Promise<OpportunitiesListResponseDto> {
    const professionalProfile = await this.findProfessionalProfile(userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ServiceOpportunityWhereInput = {
      professionalProfileId: professionalProfile.id,
      serviceRequest: {
        deletedAt: null,
      },
    };

    const [total, opportunities] = await this.prisma.$transaction([
      this.prisma.serviceOpportunity.count({ where }),
      this.prisma.serviceOpportunity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: OPPORTUNITY_SELECT,
      }),
    ]);

    return new OpportunitiesListResponseDto(
      opportunities as OpportunityListItemProperties[],
      page,
      limit,
      total,
    );
  }

  async findOneMine(
    userId: string,
    opportunityId: string,
  ): Promise<OpportunityDetailResponseDto> {
    const professionalProfile = await this.findProfessionalProfile(userId);
    return this.findOneForProfessional(
      opportunityId,
      professionalProfile.id,
    );
  }

  async markViewed(
    userId: string,
    opportunityId: string,
  ): Promise<OpportunityDetailResponseDto> {
    const professionalProfile = await this.findProfessionalProfile(userId);

    await this.prisma.serviceOpportunity.updateMany({
      where: {
        id: opportunityId,
        professionalProfileId: professionalProfile.id,
        viewedAt: null,
        serviceRequest: {
          deletedAt: null,
        },
      },
      data: { viewedAt: new Date() },
    });

    return this.findOneForProfessional(
      opportunityId,
      professionalProfile.id,
    );
  }

  private async findOneForProfessional(
    opportunityId: string,
    professionalProfileId: string,
  ): Promise<OpportunityDetailResponseDto> {
    const opportunity = await this.prisma.serviceOpportunity.findFirst({
      where: {
        id: opportunityId,
        professionalProfileId,
        serviceRequest: {
          deletedAt: null,
        },
      },
      select: OPPORTUNITY_SELECT,
    });

    if (!opportunity) {
      throw new OpportunityNotFoundException();
    }

    return new OpportunityDetailResponseDto(
      opportunity as OpportunityDetailResponseProperties,
    );
  }

  private async findProfessionalProfile(userId: string): Promise<{ id: string }> {
    const professionalProfile = await this.prisma.professionalProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
        user: {
          deletedAt: null,
          roles: {
            some: { role: Role.PROFESSIONAL },
          },
        },
      },
      select: { id: true },
    });

    if (!professionalProfile) {
      throw new ProfessionalProfileNotFoundException();
    }

    return professionalProfile;
  }
}