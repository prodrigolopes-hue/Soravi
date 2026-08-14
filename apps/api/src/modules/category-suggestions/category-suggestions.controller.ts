import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { Role } from "../../generated/prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CategorySuggestionsService } from "./category-suggestions.service";
import { PublicCategorySuggestionsAdminListResponseDto } from "./dto/public-category-suggestions-admin-list-response.dto";
import { PublicCategorySuggestionsAdminQueryDto } from "./dto/public-category-suggestions-admin-query.dto";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { PublicCategorySuggestionResponseDto } from "./dto/public-category-suggestion-response.dto";

@Controller("category-suggestions")
export class CategorySuggestionsController {
  constructor(
    private readonly categorySuggestionsService: CategorySuggestionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 600_000,
    },
  })
  create(
    @Body() input: CreatePublicCategorySuggestionDto,
  ): Promise<PublicCategorySuggestionResponseDto> {
    return this.categorySuggestionsService.createPublicSuggestion(input);
  }

  @Get("admin")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findAdminSuggestions(
    @Query() query: PublicCategorySuggestionsAdminQueryDto,
  ): Promise<PublicCategorySuggestionsAdminListResponseDto> {
    return this.categorySuggestionsService.findAllAdminSuggestions(query);
  }
}
