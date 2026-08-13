import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";

const categoryPublicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  displayOrder: true,
} satisfies Prisma.CategorySelect;

const categoryAdminSelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: categoryPublicSelect,
    });

    return categories.map(
      (category) => new CategoryResponseDto(category),
    );
  }

  async findAllAdminCategories(
    query: CategoriesAdminQueryDto,
  ): Promise<CategoriesAdminListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CategoryWhereInput = {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: categoryAdminSelect,
      }),
    ]);

    return new CategoriesAdminListResponseDto(
      items,
      page,
      pageSize,
      total,
    );
  }
}
