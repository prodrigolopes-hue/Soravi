import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { CategoriesService } from "./categories.service";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findActiveCategories();
  }

  @Get("admin")
  @Roles(Role.ADMIN)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  findAdminCategories(
    @Query() query: CategoriesAdminQueryDto,
  ): Promise<CategoriesAdminListResponseDto> {
    return this.categoriesService.findAllAdminCategories(query);
  }
}
