import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { Prisma, ProfessionalPortfolioModerationStatus } from "../../generated/prisma/client";
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
    const item = await this.prisma.professionalPortfolioItem.findFirst({ where: { id: itemId, deletedAt: null, professionalProfile: { userId, deletedAt: null, user: { deletedAt: null } } }, select: { id: true, objectKey: true } });
    if (!item) throw new NotFoundException({ code: "PROFESSIONAL_PORTFOLIO_ITEM_NOT_FOUND", message: "Foto do portfólio não encontrada." });
    await this.prisma.professionalPortfolioItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
    await this.storage.delete(item.objectKey).catch(() => undefined);
  }

  async listPending() { return this.prisma.professionalPortfolioItem.findMany({ where: { deletedAt: null, moderationStatus: ProfessionalPortfolioModerationStatus.PENDING }, select: { id: true, caption: true, moderationVersion: true, professionalProfile: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } }); }
  async privateEvidence(itemId: string) {
    const item = await this.prisma.professionalPortfolioItem.findFirst({ where: { id: itemId, deletedAt: null, moderationStatus: ProfessionalPortfolioModerationStatus.PENDING }, select: { objectKey: true } });
    if (!item) throw new NotFoundException({ code: "PORTFOLIO_ITEM_NOT_AVAILABLE", message: "Foto não disponível para análise." });
    return { url: await this.storage.createTemporaryReadUrl(item.objectKey, 60), expiresInSeconds: 60 };
  }
  async history(itemId: string) { return this.prisma.professionalPortfolioModerationDecision.findMany({ where: { portfolioItemId: itemId }, select: { result: true, reasonCode: true, contentVersion: true, createdAt: true, operator: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } }); }
  async decide(adminUserId: string, itemId: string, result: unknown, reasonCode: unknown, version: unknown): Promise<void> {
    const rejectionReasons = ["INAPPROPRIATE_CONTENT", "PERSONAL_DATA_EXPOSED", "NOT_A_WORK_PHOTO", "LOW_QUALITY"];
    if ((result !== "APPROVED" && result !== "REJECTED") || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || (reasonCode !== undefined && typeof reasonCode !== "string")) throw new BadRequestException({ code: "PORTFOLIO_DECISION_INVALID", message: "Decisão inválida." });
    const reviewedVersion = version;
    if (result === "REJECTED" && !rejectionReasons.includes(reasonCode ?? "")) throw new BadRequestException({ code: "PORTFOLIO_REJECTION_REASON_INVALID", message: "Informe um motivo padronizado para a rejeição." });
    if (result === "APPROVED" && reasonCode) throw new BadRequestException({ code: "PORTFOLIO_APPROVAL_REASON_INVALID", message: "A aprovação não aceita motivo de rejeição." });
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.professionalPortfolioItem.findFirst({ where: { id: itemId, deletedAt: null }, select: { id: true, moderationVersion: true } });
      if (!item) throw new ConflictException({ code: "PORTFOLIO_DECISION_NOT_AVAILABLE", message: "A foto foi removida, substituída ou já recebeu decisão." });
      const updated = await tx.professionalPortfolioItem.updateMany({ where: { id: item.id, moderationStatus: ProfessionalPortfolioModerationStatus.PENDING, moderationVersion: reviewedVersion }, data: { moderationStatus: result as ProfessionalPortfolioModerationStatus, rejectionReasonCode: reasonCode ?? null } });
      if (updated.count !== 1) throw new ConflictException({ code: "PORTFOLIO_DECISION_NOT_AVAILABLE", message: "A foto foi removida, substituída ou já recebeu decisão." });
      await tx.professionalPortfolioModerationDecision.create({ data: { portfolioItemId: item.id, operatorUserId: adminUserId, result: result as ProfessionalPortfolioModerationStatus, reasonCode: reasonCode ?? null, contentVersion: reviewedVersion } });
    });
  }

  private async ensurePortfolioCapacity(userId: string, professionalProfileId: string, transaction?: Prisma.TransactionClient): Promise<void> {
    const check = async (client: Prisma.TransactionClient) => {
      await lockUserCategoryProtection(client, userId);
      const count = await client.professionalPortfolioItem.count({ where: { professionalProfileId, deletedAt: null } });
      if (count >= PROFESSIONAL_PORTFOLIO_MAX_ITEMS) throw new BadRequestException({ code: "PROFESSIONAL_PORTFOLIO_LIMIT_REACHED", message: "O portfólio aceita no máximo 12 fotos." });
    };
    if (transaction) return check(transaction);
    return this.prisma.$transaction(check);
  }
}
