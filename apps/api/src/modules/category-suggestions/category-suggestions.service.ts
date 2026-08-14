import { Injectable } from "@nestjs/common";

import {
  Prisma,
  PublicCategorySuggestionStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreatePublicCategorySuggestionDto } from "./dto/create-public-category-suggestion.dto";
import { PublicCategorySuggestionsAdminListResponseDto } from "./dto/public-category-suggestions-admin-list-response.dto";
import { PublicCategorySuggestionsAdminQueryDto } from "./dto/public-category-suggestions-admin-query.dto";
import { PublicCategorySuggestionResponseDto } from "./dto/public-category-suggestion-response.dto";

const PUBLIC_CATEGORY_SUGGESTIONS_ADMIN_SELECT = {
  id: true,
  suggestedName: true,
  description: true,
  status: true,
  createdAt: true,
  name: true,
  email: true,
  phone: true,
} satisfies Prisma.PublicCategorySuggestionSelect;

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

  async findAllAdminSuggestions(
    query: PublicCategorySuggestionsAdminQueryDto,
  ): Promise<PublicCategorySuggestionsAdminListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PublicCategorySuggestionWhereInput = {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.publicCategorySuggestion.count({ where }),
      this.prisma.publicCategorySuggestion.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_CATEGORY_SUGGESTIONS_ADMIN_SELECT,
      }),
    ]);

    return new PublicCategorySuggestionsAdminListResponseDto(
      items,
      page,
      pageSize,
      total,
    );
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
