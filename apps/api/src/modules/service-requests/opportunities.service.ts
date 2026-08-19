import { Injectable } from "@nestjs/common";

import { Prisma, Role } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  OpportunitiesListResponseDto,
  OpportunityListItemProperties,
} from "./dto/opportunities-list-response.dto";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { ProfessionalProfileNotFoundException } from "../category-requests/errors/professional-profile-not-found.exception";

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
}