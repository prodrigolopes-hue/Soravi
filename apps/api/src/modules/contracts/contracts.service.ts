import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { ContractStatus, Prisma, ServiceRequestStatus } from "../../generated/prisma/client";
import { ContractResponseDto } from "./dto/contract-response.dto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ContractActionForbiddenException } from "./errors/contract-action-forbidden.exception";
import { ContractNotFoundException } from "./errors/contract-not-found.exception";
import { ContractTransitionNotAllowedException } from "./errors/contract-transition-not-allowed.exception";

const CONTRACT_RESPONSE_SELECT = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
} as const;
const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string, contractId: string): Promise<ContractResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const contract = await this.findLockedContract(transaction, contractId);

      if (contract.professionalProfile.userId !== userId) {
        throw new ContractActionForbiddenException();
      }
      if (contract.status === ContractStatus.IN_PROGRESS) {
        return this.toResponse(contract);
      }
      if (contract.status !== ContractStatus.ACCEPTED) {
        throw new ContractTransitionNotAllowedException();
      }

      const updated = await transaction.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.IN_PROGRESS, startedAt: new Date() },
        select: CONTRACT_RESPONSE_SELECT,
      });
      return this.toResponse(updated);
    });
  }

  async complete(userId: string, contractId: string): Promise<ContractResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const contract = await this.findLockedContract(transaction, contractId);

      if (contract.customerProfile.userId !== userId) {
        throw new ContractActionForbiddenException();
      }
      if (contract.status === ContractStatus.COMPLETED) {
        return this.toResponse(contract);
      }
      if (contract.status !== ContractStatus.IN_PROGRESS) {
        throw new ContractTransitionNotAllowedException();
      }

      const completedAt = new Date();
      const updated = await transaction.contract.update({
        where: { id: contract.id },
        data: { status: ContractStatus.COMPLETED, completedAt },
        select: CONTRACT_RESPONSE_SELECT,
      });
      await transaction.serviceRequest.update({
        where: { id: contract.serviceRequestId },
        data: { status: ServiceRequestStatus.COMPLETED, completedAt },
      });
      return this.toResponse(updated);
    });
  }

  async review(userId: string, contractId: string, input: CreateReviewDto) {
    return this.prisma.$transaction(async (transaction) => {
      const contract = await this.findLockedContract(transaction, contractId);
      if (contract.customerProfile.userId !== userId || contract.status !== ContractStatus.COMPLETED) throw new ForbiddenException({ code: "REVIEW_NOT_ALLOWED", message: "Avaliação não permitida." });
      this.ensureReviewWindowOpen(contract.completedAt);
      const existing = await transaction.review.findUnique({ where: { contractId } });
      if (existing) throw new ConflictException({ code: "REVIEW_ALREADY_EXISTS", message: "Esta contratação já foi avaliada." });
      const review = await transaction.review.create({ data: { contractId, customerProfileId: contract.customerProfileId, professionalProfileId: contract.professionalProfileId, rating: input.rating, comment: input.comment || null, publishedAt: null } });
      const opposite = await transaction.customerReview.findUnique({ where: { contractId }, select: { id: true } });
      if (opposite) {
        const publishedAt = new Date();
        await transaction.review.update({ where: { id: review.id }, data: { publishedAt } });
        await transaction.customerReview.update({ where: { id: opposite.id }, data: { publishedAt } });
        await this.recalculatePublishedReputations(transaction, contract.customerProfileId, contract.professionalProfileId);
      }
      return { review };
    });
  }

  async reviewCustomer(userId: string, contractId: string, input: CreateReviewDto) {
    return this.prisma.$transaction(async (transaction) => {
      const contract = await this.findLockedContract(transaction, contractId);
      if (contract.professionalProfile.userId !== userId || contract.status !== ContractStatus.COMPLETED) throw new ForbiddenException({ code: "PROFESSIONAL_REVIEW_NOT_ALLOWED", message: "Avaliação não permitida." });
      this.ensureReviewWindowOpen(contract.completedAt);
      const existing = await transaction.customerReview.findUnique({ where: { contractId } });
      if (existing) throw new ConflictException({ code: "PROFESSIONAL_REVIEW_ALREADY_EXISTS", message: "Esta contratação já foi avaliada pelo profissional." });
      const review = await transaction.customerReview.create({ data: { contractId, customerProfileId: contract.customerProfileId, professionalProfileId: contract.professionalProfileId, rating: input.rating, comment: input.comment || null, publishedAt: null } });
      const opposite = await transaction.review.findUnique({ where: { contractId }, select: { id: true } });
      if (opposite) {
        const publishedAt = new Date();
        await transaction.customerReview.update({ where: { id: review.id }, data: { publishedAt } });
        await transaction.review.update({ where: { id: opposite.id }, data: { publishedAt } });
        await this.recalculatePublishedReputations(transaction, contract.customerProfileId, contract.professionalProfileId);
      }
      return review;
    });
  }

  private async findLockedContract(transaction: Prisma.TransactionClient, contractId: string) {
    const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "contracts" WHERE "id" = ${contractId}::uuid FOR UPDATE`,
    );
    if (lockedRows.length === 0) {
      throw new ContractNotFoundException();
    }
    const contract = await transaction.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true, serviceRequestId: true, customerProfileId: true, professionalProfileId: true, status: true, startedAt: true, completedAt: true,
        customerProfile: { select: { userId: true } },
        professionalProfile: { select: { userId: true } },
      },
    });
    if (!contract) {
      throw new ContractNotFoundException();
    }
    return contract;
  }

  private async recalculatePublishedReputations(
    transaction: Prisma.TransactionClient,
    customerProfileId: string,
    professionalProfileId: string,
  ): Promise<void> {
    const [professional, customer] = await Promise.all([
      transaction.review.aggregate({ where: { professionalProfileId, publishedAt: { not: null } }, _avg: { rating: true }, _count: true }),
      transaction.customerReview.aggregate({ where: { customerProfileId, publishedAt: { not: null } }, _avg: { rating: true }, _count: true }),
    ]);
    await Promise.all([
      transaction.professionalProfile.update({ where: { id: professionalProfileId }, data: { averageRating: new Prisma.Decimal(professional._avg?.rating ?? 0), reviewCount: professional._count ?? 0 } }),
      transaction.customerProfile.update({ where: { id: customerProfileId }, data: { averageRating: new Prisma.Decimal(customer._avg?.rating ?? 0), reviewCount: customer._count ?? 0 } }),
    ]);
  }

  private ensureReviewWindowOpen(completedAt: Date | null): void {
    if (completedAt === null || Date.now() >= completedAt.getTime() + REVIEW_WINDOW_MS) {
      throw new ForbiddenException({ code: "REVIEW_WINDOW_EXPIRED", message: "O período de avaliação foi encerrado." });
    }
  }

  private toResponse(contract: {
    id: string; status: ContractStatus; startedAt: Date | null; completedAt: Date | null;
  }): ContractResponseDto {
    return new ContractResponseDto(contract);
  }
}
