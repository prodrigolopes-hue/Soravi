import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { Prisma } from "../../generated/prisma/client";
import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";
import { processProfessionalProfilePhoto, type ProcessProfessionalProfilePhotoInput } from "./professional-profile-photo-image";

export const PROFESSIONAL_PORTFOLIO_MAX_ITEMS = 12;
export const PROFESSIONAL_PORTFOLIO_CAPTION_MAX_LENGTH = 280;
const OBJECT_KEY_PREFIX = "professional-portfolios";

@Injectable()
export class ProfessionalPortfolioService {
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async addCurrent(userId: string, input: ProcessProfessionalProfilePhotoInput & { caption?: string }): Promise<void> {
    const caption = input.caption?.trim() || null;
    if (caption && caption.length > PROFESSIONAL_PORTFOLIO_CAPTION_MAX_LENGTH) throw new BadRequestException({ code: "PROFESSIONAL_PORTFOLIO_CAPTION_TOO_LONG", message: "A legenda pode ter no máximo 280 caracteres." });
    const processed = await processProfessionalProfilePhoto(input);
    const profile = await this.prisma.professionalProfile.findFirst({ where: { userId, deletedAt: null, user: { deletedAt: null } }, select: { id: true } });
    if (!profile) throw new NotFoundException({ code: "CURRENT_PROFESSIONAL_PROFILE_NOT_FOUND", message: "Perfil profissional não encontrado." });
    await this.ensurePortfolioCapacity(userId, profile.id);
    const objectKey = `${OBJECT_KEY_PREFIX}/${randomUUID()}.webp`;
    await this.storage.upload({ objectKey, body: processed.buffer, contentType: processed.mimeType, sizeBytes: processed.sizeBytes });
    try {
      await this.prisma.$transaction(async (transaction) => {
        await this.ensurePortfolioCapacity(userId, profile.id, transaction);
        await transaction.professionalPortfolioItem.create({ data: { professionalProfileId: profile.id, objectKey, mimeType: processed.mimeType, width: processed.width, height: processed.height, caption } });
      });
    } catch (error) {
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async removeCurrent(userId: string, itemId: string): Promise<void> {
    const item = await this.prisma.professionalPortfolioItem.findFirst({ where: { id: itemId, professionalProfile: { userId, deletedAt: null, user: { deletedAt: null } } }, select: { id: true, objectKey: true } });
    if (!item) throw new NotFoundException({ code: "PROFESSIONAL_PORTFOLIO_ITEM_NOT_FOUND", message: "Foto do portfólio não encontrada." });
    await this.prisma.professionalPortfolioItem.delete({ where: { id: item.id } });
    await this.storage.delete(item.objectKey).catch(() => undefined);
  }

  private async ensurePortfolioCapacity(userId: string, professionalProfileId: string, transaction?: Prisma.TransactionClient): Promise<void> {
    const check = async (client: Prisma.TransactionClient) => {
      await lockUserCategoryProtection(client, userId);
      const count = await client.professionalPortfolioItem.count({ where: { professionalProfileId } });
      if (count >= PROFESSIONAL_PORTFOLIO_MAX_ITEMS) throw new BadRequestException({ code: "PROFESSIONAL_PORTFOLIO_LIMIT_REACHED", message: "O portfólio aceita no máximo 12 fotos." });
    };
    if (transaction) return check(transaction);
    return this.prisma.$transaction(check);
  }
}
