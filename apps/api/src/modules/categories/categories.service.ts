import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CategoryRequestStatus, Prisma } from "../../generated/prisma/client";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { SplitAdminCategoryDto } from "./dto/manage-admin-category.dto";

import { PrismaService } from "../../database/prisma.service";
import { CategoriesAdminListResponseDto } from "./dto/categories-admin-list-response.dto";
import { CategoriesAdminQueryDto } from "./dto/categories-admin-query.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";

const categoryPublicSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  displayOrder: true,
} satisfies Prisma.CategorySelect;

const categoryAdminSelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  displayOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async editName(id: string, rawName: string, expectedName: string) {
    const name = rawName.trim();
    if (!name) throw new BadRequestException("Informe o nome da categoria.");
    const existing = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Categoria não encontrada.");
    const updated = await this.prisma.category.updateMany({ where: { id, name: expectedName }, data: { name } });
    if (updated.count !== 1) throw new ConflictException("A categoria foi alterada. Atualize e tente novamente.");
    return this.prisma.category.findUniqueOrThrow({ where: { id }, select: categoryAdminSelect });
  }

  async splitPreview(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, _count: { select: { serviceRequests: true, requests: true } }, professionalCategories: { select: { professionalProfile: { select: { id: true, displayName: true, user: { select: { email: true } } } } }, orderBy: { professionalProfile: { displayName: "asc" } } } },
    });
    if (!category) throw new NotFoundException("Categoria não encontrada.");
    return { id: category.id, name: category.name, slug: category.slug, serviceRequests: category._count.serviceRequests, historicalRequests: category._count.requests, professionals: category.professionalCategories.map(({ professionalProfile }) => professionalProfile) };
  }

  async split(id: string, input: SplitAdminCategoryDto) {
    const originalName = input.originalName.trim();
    const name = input.newName.trim();
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!originalName || !name || !slug || slug === "outros") throw new BadRequestException("Informe nomes válidos para as duas categorias.");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(874216)`);
        const source = await tx.category.findUnique({ where: { id }, select: { id: true, name: true, slug: true, isActive: true } });
        if (!source) throw new NotFoundException("Categoria não encontrada.");
        if (source.name !== input.expectedName) throw new ConflictException("A categoria foi alterada. Atualize e tente novamente.");
        if (!source.isActive) throw new BadRequestException("A categoria original precisa estar ativa.");
        if (await tx.category.findUnique({ where: { slug }, select: { id: true } })) throw new ConflictException("Já existe uma categoria com esse endereço. Escolha outro nome.");
        const profiles = await tx.professionalCategory.findMany({ where: { categoryId: id, professionalProfileId: { in: input.professionalProfileIds } }, select: { professionalProfileId: true, professionalProfile: { select: { userId: true } } } });
        if (profiles.length !== input.professionalProfileIds.length) throw new ConflictException("A lista de profissionais mudou. Atualize e confira novamente.");
        for (const profile of profiles.sort((a, b) => a.professionalProfile.userId.localeCompare(b.professionalProfile.userId))) {
          await lockUserCategoryProtection(tx, profile.professionalProfile.userId);
          const [official, pending] = await Promise.all([tx.professionalCategory.count({ where: { professionalProfileId: profile.professionalProfileId } }), tx.categoryRequest.count({ where: { professionalProfileId: profile.professionalProfileId, status: CategoryRequestStatus.PENDING } })]);
          if (official + pending >= 10) throw new ConflictException("Um dos profissionais selecionados já atingiu o limite de dez categorias e sugestões pendentes.");
        }
        const maximum = await tx.category.aggregate({ _max: { displayOrder: true } });
        const created = await tx.category.create({ data: { name, slug, isActive: true, displayOrder: (maximum._max.displayOrder ?? -1) + 1 }, select: { id: true, name: true, slug: true } });
        await tx.category.update({ where: { id }, data: { name: originalName } });
        if (profiles.length) await tx.professionalCategory.createMany({ data: profiles.map(({ professionalProfileId }) => ({ professionalProfileId, categoryId: created.id })) });
        return { original: { id, name: originalName, slug: source.slug }, created, linkedProfessionals: profiles.length };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) throw new ConflictException("Houve uma alteração simultânea ou endereço duplicado. Atualize e tente novamente.");
      throw error;
    }
  }

  async findActiveCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: categoryPublicSelect,
    });

    return categories.map(
      (category) => new CategoryResponseDto(category),
    );
  }

  async findAllAdminCategories(
    query: CategoriesAdminQueryDto,
  ): Promise<CategoriesAdminListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CategoryWhereInput = {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: categoryAdminSelect,
      }),
    ]);

    return new CategoriesAdminListResponseDto(
      items,
      page,
      pageSize,
      total,
    );
  }
}
