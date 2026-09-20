import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { OpportunitiesListResponseDto } from "./dto/opportunities-list-response.dto";
import { OpportunityDetailResponseDto } from "./dto/opportunity-detail-response.dto";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { OpportunitiesService } from "./opportunities.service";
import { ProfessionalDashboardResponseDto } from "./dto/professional-dashboard-response.dto";

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

  @Get("summary")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  dashboard(@CurrentUser() currentUser: AuthenticatedUser): Promise<ProfessionalDashboardResponseDto> {
    return this.opportunitiesService.dashboard(currentUser.id);
  }

  @Get(":opportunityId")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findOneMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("opportunityId", new ParseUUIDPipe()) opportunityId: string,
  ): Promise<OpportunityDetailResponseDto> {
    return this.opportunitiesService.findOneMine(currentUser.id, opportunityId);
  }

  @Post(":opportunityId/viewed")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  markViewed(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("opportunityId", new ParseUUIDPipe()) opportunityId: string,
  ): Promise<OpportunityDetailResponseDto> {
    return this.opportunitiesService.markViewed(currentUser.id, opportunityId);
  }
}
