import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../database/prisma.service";
import { ContractReportStatus, Prisma } from "../../generated/prisma/client";
import { CreateContractReportDto } from "./dto/create-contract-report.dto";
import { UpdateContractReportDto } from "./dto/update-contract-report.dto";

const OPEN_STATUSES = [ContractReportStatus.OPEN, ContractReportStatus.UNDER_REVIEW];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForContract(userId: string, contractId: string, input: CreateContractReportDto) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "contracts" WHERE "id" = ${contractId}::uuid FOR UPDATE`);
      if (locked.length === 0) throw new NotFoundException({ code: "CONTRACT_NOT_FOUND", message: "Contratação não encontrada." });
      const contract = await tx.contract.findUnique({ where: { id: contractId }, select: { customerProfile: { select: { userId: true } }, professionalProfile: { select: { userId: true } } } });
      if (!contract) throw new NotFoundException({ code: "CONTRACT_NOT_FOUND", message: "Contratação não encontrada." });
      const targetUserId = contract.customerProfile.userId === userId ? contract.professionalProfile.userId : contract.professionalProfile.userId === userId ? contract.customerProfile.userId : null;
      if (!targetUserId) throw new ForbiddenException({ code: "CONTRACT_REPORT_FORBIDDEN", message: "Você não participa desta contratação." });
      const existing = await tx.contractReport.findFirst({ where: { contractId, reporterUserId: userId, status: { in: OPEN_STATUSES } }, select: { id: true } });
      if (existing) throw new ConflictException({ code: "CONTRACT_REPORT_ALREADY_OPEN", message: "Já existe uma denúncia em aberto para esta contratação." });
      const report = await tx.contractReport.create({ data: { protocol: this.protocol(), contractId, reporterUserId: userId, targetUserId, reason: input.reason, description: input.description, history: { create: { status: ContractReportStatus.OPEN, actorUserId: userId } } }, select: { protocol: true } });
      return { protocol: report.protocol };
    });
  }

  async listForAdmin() {
    return this.prisma.contractReport.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, protocol: true, status: true, reason: true, createdAt: true, contract: { select: { id: true } } } });
  }

  async detailForAdmin(id: string) {
    const report = await this.prisma.contractReport.findUnique({ where: { id }, select: { id: true, protocol: true, status: true, reason: true, description: true, resolution: true, createdAt: true, reviewedAt: true, contractId: true, reporter: { select: { id: true, name: true } }, target: { select: { id: true, name: true } }, reviewer: { select: { id: true, name: true } }, history: { orderBy: { createdAt: "asc" }, select: { status: true, reason: true, createdAt: true, actor: { select: { name: true } } } } } });
    if (!report) throw new NotFoundException({ code: "CONTRACT_REPORT_NOT_FOUND", message: "Denúncia não encontrada." });
    return report;
  }

  async updateForAdmin(actorUserId: string, id: string, input: UpdateContractReportDto) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.contractReport.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!report) throw new NotFoundException({ code: "CONTRACT_REPORT_NOT_FOUND", message: "Denúncia não encontrada." });
      const allowed: readonly ContractReportStatus[] = report.status === ContractReportStatus.OPEN
        ? [ContractReportStatus.UNDER_REVIEW, ContractReportStatus.RESOLVED, ContractReportStatus.DISMISSED]
        : report.status === ContractReportStatus.UNDER_REVIEW
          ? [ContractReportStatus.RESOLVED, ContractReportStatus.DISMISSED]
          : [];
      if (!allowed.includes(input.status)) throw new ConflictException({ code: "CONTRACT_REPORT_STATUS_TRANSITION_NOT_ALLOWED", message: "Transição de denúncia não permitida." });
      const closing = input.status === ContractReportStatus.RESOLVED || input.status === ContractReportStatus.DISMISSED;
      await tx.contractReport.update({ where: { id }, data: { status: input.status, resolution: input.resolution, reviewedByUserId: actorUserId, reviewedAt: closing ? new Date() : null, history: { create: { status: input.status, reason: input.resolution, actorUserId } } } });
    });
  }

  private protocol(): string {
    return `DEN-${randomUUID().replace(/-/gu, "").slice(0, 12).toUpperCase()}`;
  }
}
