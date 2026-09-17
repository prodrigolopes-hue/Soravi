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
      const existing = await transaction.review.findUnique({ where: { contractId } });
      if (existing) throw new ConflictException({ code: "REVIEW_ALREADY_EXISTS", message: "Esta contratação já foi avaliada." });
      const review = await transaction.review.create({ data: { contractId, customerProfileId: contract.customerProfileId, professionalProfileId: contract.professionalProfileId, rating: input.rating, comment: input.comment || null } });
      const aggregate = await transaction.review.aggregate({ where: { professionalProfileId: contract.professionalProfileId }, _avg: { rating: true }, _count: { id: true } });
      const reputation = await transaction.professionalProfile.update({ where: { id: contract.professionalProfileId }, data: { averageRating: new Prisma.Decimal(aggregate._avg.rating ?? 0), reviewCount: aggregate._count.id }, select: { averageRating: true, reviewCount: true } });
      return { review, reputation };
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

  private toResponse(contract: {
    id: string; status: ContractStatus; startedAt: Date | null; completedAt: Date | null;
  }): ContractResponseDto {
    return new ContractResponseDto(contract);
  }
}
