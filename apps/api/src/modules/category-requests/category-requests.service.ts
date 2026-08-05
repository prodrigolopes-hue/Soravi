import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  CategoryRequestStatus,
  Prisma,
} from "../../generated/prisma/client";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestAlreadyPendingException } from "./errors/category-request-already-pending.exception";
import { ProfessionalProfileNotFoundException } from "./errors/professional-profile-not-found.exception";

const CATEGORY_REQUEST_PUBLIC_SELECT = {
  id: true,
  suggestedName: true,
  description: true,
  status: true,
  createdAt: true,
} satisfies Prisma.CategoryRequestSelect;

@Injectable()
export class CategoryRequestsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async createCategoryRequest(
    userId: string,
    input: CreateCategoryRequestDto,
  ): Promise<CategoryRequestResponseDto> {
    const professionalProfile =
      await this.prisma.professionalProfile.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    if (!professionalProfile) {
      throw new ProfessionalProfileNotFoundException();
    }

    const suggestedName = input.suggestedName
      .trim()
      .replace(/\s+/g, " ");

    const suggestedNameNormalized = suggestedName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const pendingRequest =
      await this.prisma.categoryRequest.findFirst({
        where: {
          professionalProfileId:
            professionalProfile.id,
          status: CategoryRequestStatus.PENDING,
          suggestedNameNormalized,
        },
        select: {
          id: true,
        },
      });

    if (pendingRequest) {
      throw new CategoryRequestAlreadyPendingException();
    }

    const categoryRequest =
      await this.prisma.categoryRequest.create({
        data: {
          professionalProfileId:
            professionalProfile.id,
          suggestedName,
          suggestedNameNormalized,
          description:
            input.description?.trim() || null,
          status: CategoryRequestStatus.PENDING,
        },
        select: CATEGORY_REQUEST_PUBLIC_SELECT,
      });

    return new CategoryRequestResponseDto(
      categoryRequest,
    );
  }
}