import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { EditAdminCategoryDto, SplitAdminCategoryDto } from "./dto/manage-admin-category.dto";
import { CategoriesService } from "./categories.service";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { SetCategoryFeaturedDto } from "./dto/set-category-featured.dto";

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
  @Get("admin/:id/split-preview")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  splitPreview(@Param("id", ParseUUIDPipe) id: string) {
    return this.categoriesService.splitPreview(id);
  }

  @Patch("admin/:id")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  editName(@Param("id", ParseUUIDPipe) id: string, @Body() input: EditAdminCategoryDto) {
    return this.categoriesService.editName(id, input.name, input.expectedName);
  }

  @Patch("admin/:id/featured")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  setFeatured(@Param("id", ParseUUIDPipe) id: string, @Body() input: SetCategoryFeaturedDto) {
    return this.categoriesService.setFeatured(id, input.isFeatured);
  }

  @Post("admin/:id/split")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  split(@Param("id", ParseUUIDPipe) id: string, @Body() input: SplitAdminCategoryDto) {
    return this.categoriesService.split(id, input);
  }

}
