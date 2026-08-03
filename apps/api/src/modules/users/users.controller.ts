import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
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
}