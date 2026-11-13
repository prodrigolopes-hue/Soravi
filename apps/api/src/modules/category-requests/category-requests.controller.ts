import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CategoryRequestsService } from "./category-requests.service";
import { CategoryRequestsAdminListResponseDto } from "./dto/category-requests-admin-list-response.dto";
import { CategoryRequestsAdminQueryDto } from "./dto/category-requests-admin-query.dto";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";
import { DecideCategoryRequestDto } from "./dto/decide-category-request.dto";

@Controller("category-requests")
export class CategoryRequestsController {
  constructor(
    private readonly categoryRequestsService: CategoryRequestsService,
  ) {}

  @Post()
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: CreateCategoryRequestDto,
  ): Promise<CategoryRequestResponseDto> {
    return this.categoryRequestsService.createCategoryRequest(
      currentUser.id,
      input,
    );
  }

  @Get("mine")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findMine(@CurrentUser() currentUser: AuthenticatedUser): Promise<CategoryRequestResponseDto[]> {
    return this.categoryRequestsService.findMine(currentUser.id);
  }

  @Get("admin")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findAdminCategoryRequests(
    @Query() query: CategoryRequestsAdminQueryDto,
  ): Promise<CategoryRequestsAdminListResponseDto> {
    return this.categoryRequestsService.findAllAdminCategoryRequests(
      query,
    );
  }

  @Patch("admin/:id")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  decide(@Param("id") id: string, @CurrentUser() currentUser: AuthenticatedUser, @Body() input: DecideCategoryRequestDto): Promise<CategoryRequestResponseDto> {
    return this.categoryRequestsService.decide(id, currentUser.id, input);
  }
}
