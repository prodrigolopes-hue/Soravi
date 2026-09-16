import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { ContractStatus, Prisma, ServiceRequestStatus } from "../../generated/prisma/client";
import { ContractResponseDto } from "./dto/contract-response.dto";
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
        id: true, serviceRequestId: true, status: true, startedAt: true, completedAt: true,
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
