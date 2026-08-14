import { Injectable } from "@nestjs/common";

import {
  Prisma,
  PublicCategorySuggestionStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { PublicCategorySuggestionResponseDto } from "./dto/public-category-suggestion-response.dto";

@Injectable()
export class CategorySuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createPublicSuggestion(
    input: CreatePublicCategorySuggestionDto,
  ): Promise<PublicCategorySuggestionResponseDto> {
    const now = new Date();

    const createData = {
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() ?? null,
      suggestedName: input.suggestedName.trim(),
      description: this.normalizeOptionalString(input.description),
      status: PublicCategorySuggestionStatus.PENDING,
      privacyNoticeAcceptedAt: now,
    } satisfies Prisma.PublicCategorySuggestionCreateInput;

    await this.prisma.publicCategorySuggestion.create({
      data: createData,
    });

    return new PublicCategorySuggestionResponseDto();
  }

  private normalizeOptionalString(
    value?: string | null,
  ): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  }
}
