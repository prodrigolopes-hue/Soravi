import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { LaunchInterestsService } from "./launch-interests.service";
import { CreateLaunchInterestDto } from "./dto/create-launch-interest.dto";
import { LaunchInterestAdminListResponseDto } from "./dto/launch-interest-admin-response.dto";
import { LaunchInterestAdminQueryDto } from "./dto/launch-interest-admin-query.dto";
import { LaunchInterestRegistrationResponseDto } from "./dto/launch-interest-response.dto";

@Controller("launch-interests")
export class LaunchInterestsController {
  constructor(
    private readonly launchInterestsService: LaunchInterestsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(
    @Body() input: CreateLaunchInterestDto,
  ): Promise<LaunchInterestRegistrationResponseDto> {
    return this.launchInterestsService.register(input);
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findAllAdmin(
    @Query() query: LaunchInterestAdminQueryDto,
  ): Promise<LaunchInterestAdminListResponseDto> {
    return this.launchInterestsService.findAllAdmin(query);
  }
}
