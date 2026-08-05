import { Body, Controller, Post, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CategoryRequestsService } from "./category-requests.service";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";

@Controller("category-requests")
export class CategoryRequestsController {
  constructor(
    private readonly categoryRequestsService: CategoryRequestsService,
  ) {}

  @Post()
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: CreateCategoryRequestDto,
  ): Promise<CategoryRequestResponseDto> {
    return this.categoryRequestsService.createCategoryRequest(
      currentUser.id,
      input,
    );
  }
}
