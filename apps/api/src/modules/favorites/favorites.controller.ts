import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { FavoriteResponseDto } from "./dto/favorite-response.dto";
import { FavoritesService } from "./favorites.service";

@Controller("favorites")
@Roles(Role.CUSTOMER)
@UseGuards(AccessTokenGuard, RolesGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<FavoriteResponseDto[]> {
    return this.favoritesService.findMine(user.id);
  }

  @Post(":professionalProfileId")
  create(@CurrentUser() user: AuthenticatedUser, @Param("professionalProfileId", new ParseUUIDPipe()) professionalProfileId: string): Promise<FavoriteResponseDto> {
    return this.favoritesService.create(user.id, professionalProfileId);
  }

  @Delete(":professionalProfileId")
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("professionalProfileId", new ParseUUIDPipe()) professionalProfileId: string): Promise<void> {
    await this.favoritesService.remove(user.id, professionalProfileId);
  }
}
