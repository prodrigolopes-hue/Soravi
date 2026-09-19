import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { FavoriteResponseDto } from "./dto/favorite-response.dto";

const favoriteSelect = {
  id: true,
  createdAt: true,
  professionalProfile: {
    select: {
      id: true, displayName: true, averageRating: true, reviewCount: true,
      professionalCategories: { where: { category: { isActive: true } }, select: { category: { select: { name: true } } } },
    },
  },
} as const;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, professionalProfileId: string): Promise<FavoriteResponseDto> {
    const customer = await this.customer(userId);
    const professional = await this.prisma.professionalProfile.findFirst({ where: { id: professionalProfileId, deletedAt: null, user: { deletedAt: null } }, select: { id: true } });
    if (!professional) throw new NotFoundException({ code: "PROFESSIONAL_PROFILE_NOT_FOUND", message: "Profissional não encontrado." });
    try {
      return this.toResponse(await this.prisma.favorite.create({ data: { customerProfileId: customer.id, professionalProfileId: professional.id }, select: favoriteSelect }));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException({ code: "FAVORITE_ALREADY_EXISTS", message: "Este profissional já está nos favoritos." });
      }
      throw error;
    }
  }

  async remove(userId: string, professionalProfileId: string): Promise<void> {
    const customer = await this.customer(userId);
    await this.prisma.favorite.deleteMany({ where: { customerProfileId: customer.id, professionalProfileId } });
  }

  async findMine(userId: string): Promise<FavoriteResponseDto[]> {
    const customer = await this.customer(userId);
    const favorites = await this.prisma.favorite.findMany({ where: { customerProfileId: customer.id, professionalProfile: { deletedAt: null, user: { deletedAt: null } } }, orderBy: { createdAt: "desc" }, select: favoriteSelect });
    return favorites.map((favorite) => this.toResponse(favorite));
  }

  private async customer(userId: string): Promise<{ id: string }> {
    const customer = await this.prisma.customerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!customer) throw new NotFoundException({ code: "CUSTOMER_PROFILE_NOT_FOUND", message: "Perfil de cliente não encontrado." });
    return customer;
  }

  private toResponse(favorite: { id: string; createdAt: Date; professionalProfile: { id: string; displayName: string; averageRating: { toNumber(): number }; reviewCount: number; professionalCategories: Array<{ category: { name: string } }> } }): FavoriteResponseDto {
    return new FavoriteResponseDto(favorite.id, {
      id: favorite.professionalProfile.id, displayName: favorite.professionalProfile.displayName,
      averageRating: favorite.professionalProfile.averageRating.toNumber(), reviewCount: favorite.professionalProfile.reviewCount,
      categories: favorite.professionalProfile.professionalCategories.map((item) => item.category.name),
    }, favorite.createdAt);
  }
}
