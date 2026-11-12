import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  CategoryRequestStatus,
  Prisma,
} from "../../generated/prisma/client";
import { CategoryRequestsAdminListResponseDto } from "./dto/category-requests-admin-list-response.dto";
import { CategoryRequestsAdminQueryDto } from "./dto/category-requests-admin-query.dto";
import { CategoryRequestResponseDto } from "./dto/category-request-response.dto";
import { CreateCategoryRequestDto } from "./dto/create-category-request.dto";
import { DecideCategoryRequestDto } from "./dto/decide-category-request.dto";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CategoryRequestAlreadyPendingException } from "./errors/category-request-already-pending.exception";
import { ProfessionalProfileNotFoundException } from "./errors/professional-profile-not-found.exception";

const CATEGORY_REQUEST_PUBLIC_SELECT = {
  id: true,
  suggestedName: true,
  description: true,
  status: true,
  reviewNotes: true,
  resolvedCategory: { select: { id: true, name: true, slug: true } },
  createdAt: true,
} satisfies Prisma.CategoryRequestSelect;

const CATEGORY_REQUEST_CREATE_SELECT = {
  id: true,
  suggestedName: true,
  description: true,
  status: true,
  createdAt: true,
} satisfies Prisma.CategoryRequestSelect;

const CATEGORY_REQUEST_ADMIN_SELECT = {
  id: true,
  suggestedName: true,
  status: true,
  reviewNotes: true,
  createdAt: true,
  reviewedAt: true,
  professionalProfile: {
    select: {
      id: true,
      displayName: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  resolvedCategory: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.CategoryRequestSelect;

@Injectable()
export class CategoryRequestsService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  async findAllAdminCategoryRequests(
    query: CategoryRequestsAdminQueryDto,
  ): Promise<CategoryRequestsAdminListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CategoryRequestWhereInput = {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.categoryRequest.count({ where }),
      this.prisma.categoryRequest.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: CATEGORY_REQUEST_ADMIN_SELECT,
      }),
    ]);

    return new CategoryRequestsAdminListResponseDto(
      items,
      page,
      pageSize,
      total,
    );
  }

  async createCategoryRequest(
    userId: string,
    input: CreateCategoryRequestDto,
  ): Promise<CategoryRequestResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      await lockUserCategoryProtection(transaction, userId);
      const professionalProfile =
      await transaction.professionalProfile.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    if (!professionalProfile) {
      throw new ProfessionalProfileNotFoundException();
    }

    const suggestedName = input.suggestedName
      .trim()
      .replace(/\s+/g, " ");

    const suggestedNameNormalized = suggestedName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const pendingRequest =
      await transaction.categoryRequest.findFirst({
        where: {
          professionalProfileId:
            professionalProfile.id,
          status: CategoryRequestStatus.PENDING,
          suggestedNameNormalized,
        },
        select: {
          id: true,
        },
      });

    if (pendingRequest) {
      throw new CategoryRequestAlreadyPendingException();
    }

    const [officialCategoryCount, pendingRequestCount] = await Promise.all([
      transaction.professionalCategory.count({ where: { professionalProfileId: professionalProfile.id } }),
      transaction.categoryRequest.count({ where: { professionalProfileId: professionalProfile.id, status: CategoryRequestStatus.PENDING } }),
    ]);
    if (officialCategoryCount + pendingRequestCount >= 3) {
      throw new ConflictException({ code: "PROFESSIONAL_CATEGORY_LIMIT_REACHED", message: "O profissional já atingiu o limite de três categorias e solicitações." });
    }

    const categoryRequest =
      await transaction.categoryRequest.create({
        data: {
          professionalProfileId:
            professionalProfile.id,
          suggestedName,
          suggestedNameNormalized,
          description:
            input.description?.trim() || null,
          status: CategoryRequestStatus.PENDING,
        },
        select: CATEGORY_REQUEST_CREATE_SELECT,
      });

    return new CategoryRequestResponseDto(
      categoryRequest,
    );
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async findMine(userId: string): Promise<CategoryRequestResponseDto[]> {
    const profile = await this.prisma.professionalProfile.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
    if (!profile) throw new ProfessionalProfileNotFoundException();
    const items = await this.prisma.categoryRequest.findMany({ where: { professionalProfileId: profile.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: CATEGORY_REQUEST_PUBLIC_SELECT });
    return items.map((item) => new CategoryRequestResponseDto(item));
  }

  async decide(id: string, reviewerUserId: string, input: DecideCategoryRequestDto): Promise<CategoryRequestResponseDto> {
    try {
      return await this.decideOnce(id, reviewerUserId, input);
    } catch (error: unknown) {
      if (this.isTransactionSerializationError(error)) {
        throw new ConflictException({
          code: "CATEGORY_REQUEST_DECISION_CONFLICT",
          message: "A solicitação foi alterada simultaneamente. Atualize a lista e tente novamente.",
        });
      }
      throw error;
    }
  }

  private async decideOnce(id: string, reviewerUserId: string, input: DecideCategoryRequestDto): Promise<CategoryRequestResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const request = await transaction.categoryRequest.findUnique({ where: { id }, select: { id: true, status: true, professionalProfileId: true, suggestedName: true } });
      if (!request) throw new NotFoundException({ code: "CATEGORY_REQUEST_NOT_FOUND", message: "Solicitação de categoria não encontrada." });
      if (request.status !== CategoryRequestStatus.PENDING) throw new ConflictException({ code: "CATEGORY_REQUEST_ALREADY_DECIDED", message: "A solicitação já foi decidida." });
      const profile = await transaction.professionalProfile.findUnique({ where: { id: request.professionalProfileId }, select: { userId: true } });
      if (!profile) throw new NotFoundException({ code: "PROFESSIONAL_PROFILE_NOT_FOUND", message: "Perfil profissional não encontrado." });
      await lockUserCategoryProtection(transaction, profile.userId);
      const categoryCount = await transaction.professionalCategory.count({ where: { professionalProfileId: request.professionalProfileId } });
      const notes = input.reviewNotes?.trim() || null;
      if (input.decision === "REJECT") {
        if (!notes) throw new BadRequestException({ code: "REJECTION_REASON_REQUIRED", message: "Informe o motivo da recusa." });
        const updated = await transaction.categoryRequest.update({ where: { id }, data: { status: CategoryRequestStatus.REJECTED, reviewNotes: notes, reviewedAt: new Date(), reviewedByUserId: reviewerUserId }, select: CATEGORY_REQUEST_PUBLIC_SELECT });
        return new CategoryRequestResponseDto(updated);
      }
      let categoryId: string;
      if (input.decision === "ASSOCIATE") {
        if (!input.categoryId) throw new BadRequestException({ code: "CATEGORY_ID_REQUIRED", message: "Selecione uma categoria existente." });
        const category = await transaction.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
        if (!category) throw new BadRequestException({ code: "INVALID_CATEGORY", message: "Selecione uma categoria oficial ativa." });
        categoryId = category.id;
      } else {
        const name = input.categoryName?.trim() || request.suggestedName;
        const slug = input.categorySlug?.trim().toLowerCase() || this.slugify(name);
        if (!slug || slug === "outros") throw new BadRequestException({ code: "INVALID_CATEGORY_SLUG", message: "Informe uma categoria oficial específica." });
        const existing = await transaction.category.findUnique({ where: { slug }, select: { id: true, isActive: true } });
        if (existing) {
          if (!existing.isActive) throw new ConflictException({ code: "CATEGORY_SLUG_INACTIVE", message: "Já existe uma categoria inativa com este identificador." });
          categoryId = existing.id;
        } else {
          categoryId = (await transaction.category.create({ data: { name, slug, isActive: true }, select: { id: true } })).id;
        }
      }
      const existingAssociation = await transaction.professionalCategory.findUnique({ where: { professionalProfileId_categoryId: { professionalProfileId: request.professionalProfileId, categoryId } }, select: { id: true } });
      if (!existingAssociation && categoryCount >= 3) throw new ConflictException({ code: "PROFESSIONAL_CATEGORY_LIMIT_REACHED", message: "O profissional já atingiu o limite de três categorias." });
      await transaction.professionalCategory.upsert({ where: { professionalProfileId_categoryId: { professionalProfileId: request.professionalProfileId, categoryId } }, update: {}, create: { professionalProfileId: request.professionalProfileId, categoryId } });
      const updated = await transaction.categoryRequest.update({ where: { id }, data: { status: input.decision === "CREATE" ? CategoryRequestStatus.APPROVED : CategoryRequestStatus.MERGED, resolvedCategoryId: categoryId, reviewNotes: notes, reviewedAt: new Date(), reviewedByUserId: reviewerUserId }, select: CATEGORY_REQUEST_PUBLIC_SELECT });
      return new CategoryRequestResponseDto(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private slugify(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120);
  }

  private isTransactionSerializationError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
  }
}
