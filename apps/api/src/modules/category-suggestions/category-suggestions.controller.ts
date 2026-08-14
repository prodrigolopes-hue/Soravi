import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";

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
  create(
    @Body() input: CreatePublicCategorySuggestionDto,
  ): Promise<PublicCategorySuggestionResponseDto> {
    return this.categorySuggestionsService.createPublicSuggestion(input);
  }
}
