import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { CategorySuggestionsService } from "./category-suggestions.service";
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
}
