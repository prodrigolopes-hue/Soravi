import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { OpportunitiesListResponseDto } from "./dto/opportunities-list-response.dto";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { OpportunitiesService } from "./opportunities.service";

@Controller("opportunities")
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Get()
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: OpportunitiesQueryDto,
  ): Promise<OpportunitiesListResponseDto> {
    return this.opportunitiesService.findMine(currentUser.id, query);
  }
}