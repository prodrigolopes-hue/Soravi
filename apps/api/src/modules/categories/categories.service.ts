import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { CategoryResponseDto } from "./dto/category-response.dto";

const categoryPublicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  displayOrder: true,
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
}
