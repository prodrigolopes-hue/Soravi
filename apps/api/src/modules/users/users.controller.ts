import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { UsersAdminCustomersListResponseDto } from "./dto/users-admin-customers-list-response.dto";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalsListResponseDto } from "./dto/users-admin-professionals-list-response.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UpdateCurrentUserPhoneDto } from "./dto/update-current-user-phone.dto";
import { UsersPhoneService } from "./users-phone.service";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersPhoneService: UsersPhoneService,
  ) {}

  @Get("me")
  @UseGuards(AccessTokenGuard)
  findCurrentUser(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findSafeById(
      currentUser.id,
    );
  }

  @Patch("me/phone")
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  updateCurrentUserPhone(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: UpdateCurrentUserPhoneDto,
  ): Promise<UserResponseDto> {
    return this.usersPhoneService.updateCurrentUserPhone(
      currentUser.id,
      currentUser.sessionId,
      input,
    );
  }

  @Get("me/professional-access")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  validateProfessionalAccess(): {
    data: {
      authorized: true;
      role: Role;
    };
  } {
    return {
      data: {
        authorized: true,
        role: Role.PROFESSIONAL,
      },
    };
  }

  @Get("admin/customers")
  @Roles(Role.ADMIN)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  findAdminCustomers(
    @Query() query: UsersAdminCustomersQueryDto,
  ): Promise<UsersAdminCustomersListResponseDto> {
    return this.usersService.findAllAdminCustomers(query);
  }

  @Get("admin/professionals")
  @Roles(Role.ADMIN)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  findAdminProfessionals(
    @Query() query: UsersAdminProfessionalsQueryDto,
  ): Promise<UsersAdminProfessionalsListResponseDto> {
    return this.usersService.findAllAdminProfessionals(query);
  }
}
