import { Injectable } from "@nestjs/common";
import { ConflictException } from "@nestjs/common";

import {
  CommunicationChannel,
  Prisma,
  ProfessionalVerificationStatus,
  ProposalStatus,
  Role,
  ServiceRequestStatus,
  ContractStatus,
  ConversationStatus,
  NotificationType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { OutboundNotificationsService } from "../notifications/outbound-notifications.service";
import {
  AcceptProposalResponseDto,
  AcceptProposalResponseProperties,
} from "./dto/accept-proposal-response.dto";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import {
  ProposalResponseDto,
  ProposalResponseProperties,
} from "./dto/proposal-response.dto";
import {
  ProposalReceivedProperties,
  ProposalsReceivedListResponseDto,
} from "./dto/proposals-received-list-response.dto";
import { ProposalsReceivedQueryDto } from "./dto/proposals-received-query.dto";
import { CustomerProfileNotFoundException } from "./errors/customer-profile-not-found.exception";
import { ContractAlreadyExistsException } from "./errors/contract-already-exists.exception";
import { ProposalAlreadyExistsException } from "./errors/proposal-already-exists.exception";
import { ProposalNotActiveException } from "./errors/proposal-not-active.exception";
import { ProposalNotFoundException } from "./errors/proposal-not-found.exception";
import { ProposalCreationUnavailableException } from "./errors/proposal-creation-unavailable.exception";
import { ServiceRequestNotFoundException } from "./errors/service-request-not-found.exception";
import { ServiceRequestNotAcceptingProposalsException } from "./errors/service-request-not-accepting-proposals.exception";
import { normalizeDisplayName } from "../users/user-name.utils";

const PROPOSAL_RESPONSE_SELECT = {
  id: true,
  serviceRequestId: true,
  amountInCents: true,
  estimatedDurationValue: true,
  estimatedDurationUnit: true,
  message: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProposalSelect;

const PROPOSAL_RECEIVED_SELECT = {
  id: true,
  amountInCents: true,
  estimatedDurationValue: true,
  estimatedDurationUnit: true,
  message: true,
  status: true,
  submittedAt: true,
  professionalProfile: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.ProposalSelect;

const MAX_PROPOSALS_PER_REQUEST = 12;

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundNotificationsService: OutboundNotificationsService,
  ) {}

  async findReceived(
    userId: string,
    serviceRequestId: string,
    query: ProposalsReceivedQueryDto,
  ): Promise<ProposalsReceivedListResponseDto> {
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customerProfile) {
      throw new CustomerProfileNotFoundException();
    }

    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: {
        id: serviceRequestId,
        customerProfileId: customerProfile.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!serviceRequest) {
      throw new ServiceRequestNotFoundException();
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? "desc";
    const where: Prisma.ProposalWhereInput = {
      serviceRequestId: serviceRequest.id,
      isVisible: true,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, proposals] = await this.prisma.$transaction([
      this.prisma.proposal.count({ where }),
      this.prisma.proposal.findMany({
        where,
        orderBy: { submittedAt: sort },
        skip: (page - 1) * limit,
        take: limit,
        select: PROPOSAL_RECEIVED_SELECT,
      }),
    ]);

    const items: ProposalReceivedProperties[] = proposals.map((proposal) => {
      const { professionalProfile, ...proposalProperties } = proposal;

      return {
        ...proposalProperties,
        professionalName: normalizeDisplayName(
          professionalProfile.displayName,
        ),
      };
    });

    return new ProposalsReceivedListResponseDto(
      items,
      page,
      limit,
      total,
    );
  }

  async create(
    userId: string,
    serviceRequestId: string,
    dto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    try {
      const proposal = await this.prisma.$transaction(async (transaction) => {
        const professionalProfile = await transaction.professionalProfile.findFirst({
          where: {
            userId,
            verificationStatus: ProfessionalVerificationStatus.APPROVED,
            isAvailable: true,
            deletedAt: null,
            user: {
              deletedAt: null,
              roles: { some: { role: Role.PROFESSIONAL } },
            },
          },
          select: { id: true },
        });

        if (!professionalProfile) {
          throw new ProposalCreationUnavailableException();
        }

        const serviceRequest = await transaction.serviceRequest.findFirst({
          where: { id: serviceRequestId, deletedAt: null },
          select: {
            id: true,
            status: true,
            visibleProposalLimit: true,
            customerProfile: {
              select: { userId: true },
            },
          },
        });

        if (!serviceRequest) {
          throw new ProposalCreationUnavailableException();
        }

        await transaction.$queryRaw(Prisma.sql`
          SELECT "id" FROM "service_requests" WHERE "id" = ${serviceRequest.id}::uuid FOR UPDATE
        `);

        const lockedServiceRequest = await transaction.serviceRequest.findFirst({
          where: { id: serviceRequestId, deletedAt: null },
          select: { status: true, visibleProposalLimit: true, customerProfile: { select: { userId: true } } },
        });

        if (!lockedServiceRequest) {
          throw new ProposalCreationUnavailableException();
        }

        const opportunity = await transaction.serviceOpportunity.findUnique({
          where: {
            serviceRequestId_professionalProfileId: {
              serviceRequestId,
              professionalProfileId: professionalProfile.id,
            },
          },
          select: { id: true },
        });

        if (!opportunity) {
          throw new ProposalCreationUnavailableException();
        }

        if (
          lockedServiceRequest.status !== ServiceRequestStatus.OPEN &&
          lockedServiceRequest.status !== ServiceRequestStatus.RECEIVING_PROPOSALS
        ) {
          throw new ServiceRequestNotAcceptingProposalsException();
        }

        const existingProposal = await transaction.proposal.findUnique({
          where: {
            serviceRequestId_professionalProfileId: {
              serviceRequestId,
              professionalProfileId: professionalProfile.id,
            },
          },
          select: { id: true },
        });

        if (existingProposal) {
          throw new ProposalAlreadyExistsException();
        }

        const total = await transaction.proposal.count({
          where: { serviceRequestId },
        });
        if (total >= MAX_PROPOSALS_PER_REQUEST) {
          throw new ConflictException("Esta solicitação já atingiu o limite de 12 propostas.");
        }

        const visibleActiveCount = await transaction.proposal.count({
          where: { serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: true },
        });

        const createdProposal = await transaction.proposal.create({
          data: {
            serviceRequestId,
            professionalProfileId: professionalProfile.id,
            amountInCents: dto.amountInCents,
            estimatedDurationValue: dto.estimatedDurationValue,
            estimatedDurationUnit: dto.estimatedDurationUnit,
            message: dto.message,
            status: ProposalStatus.ACTIVE,
            isVisible: visibleActiveCount < lockedServiceRequest.visibleProposalLimit,
            acceptedAt: null,
            rejectedAt: null,
            withdrawnAt: null,
            expiredAt: null,
          },
          select: PROPOSAL_RESPONSE_SELECT,
        });

        const notification = await transaction.notification.upsert({
          where: {
            userId_type_resourceType_resourceId: {
              userId: lockedServiceRequest.customerProfile.userId,
              type: NotificationType.PROPOSAL_CREATED,
              resourceType: "PROPOSAL",
              resourceId: createdProposal.id,
            },
          },
          update: {},
          create: {
            userId: lockedServiceRequest.customerProfile.userId,
            type: NotificationType.PROPOSAL_CREATED,
            title: "Nova proposta recebida",
            message: "Você recebeu uma nova proposta para sua solicitação.",
            resourceType: "PROPOSAL",
            resourceId: createdProposal.id,
          },
          select: { id: true },
        });

        await this.outboundNotificationsService.createPending({
          transaction,
          notificationId: notification.id,
          userId: lockedServiceRequest.customerProfile.userId,
          channel: CommunicationChannel.WHATSAPP,
          eventType: NotificationType.PROPOSAL_CREATED,
        });

        if (lockedServiceRequest.status === ServiceRequestStatus.OPEN) {
          await transaction.serviceRequest.update({
            where: { id: serviceRequestId },
            data: { status: ServiceRequestStatus.RECEIVING_PROPOSALS },
          });
        }

        return createdProposal;
      });

      return new ProposalResponseDto(
        proposal as ProposalResponseProperties,
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ProposalAlreadyExistsException();
      }

      throw error;
    }
  }

  async accept(
    userId: string,
    proposalId: string,
  ): Promise<AcceptProposalResponseDto> {
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const customerProfile = await transaction.customerProfile.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (!customerProfile) {
          throw new ProposalNotFoundException();
        }

        const proposal = await transaction.proposal.findUnique({
          where: { id: proposalId },
          select: {
            id: true,
            serviceRequestId: true,
            professionalProfileId: true,
            amountInCents: true,
            estimatedDurationValue: true,
            estimatedDurationUnit: true,
            message: true,
          },
        });

        if (!proposal) {
          throw new ProposalNotFoundException();
        }

        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT "id"
            FROM "service_requests"
            WHERE "id" = ${proposal.serviceRequestId}::uuid
            FOR UPDATE
          `,
        );

        if (lockedRows.length === 0) {
          throw new ProposalNotFoundException();
        }

        const serviceRequest = await transaction.serviceRequest.findFirst({
          where: {
            id: proposal.serviceRequestId,
            customerProfileId: customerProfile.id,
            deletedAt: null,
          },
          select: { id: true, status: true },
        });

        if (!serviceRequest) {
          throw new ProposalNotFoundException();
        }

        if (
          serviceRequest.status !== ServiceRequestStatus.RECEIVING_PROPOSALS &&
          serviceRequest.status !== ServiceRequestStatus.IN_NEGOTIATION
        ) {
          throw new ServiceRequestNotAcceptingProposalsException();
        }

        const currentProposal = await transaction.proposal.findUnique({
          where: { id: proposal.id },
          select: { status: true },
        });

        if (!currentProposal) {
          throw new ProposalNotFoundException();
        }

        if (currentProposal.status !== ProposalStatus.ACTIVE) {
          throw new ProposalNotActiveException();
        }

        const existingContract = await transaction.contract.findUnique({
          where: { serviceRequestId: serviceRequest.id },
          select: { id: true },
        });

        if (existingContract) {
          throw new ContractAlreadyExistsException();
        }

        const acceptedAt = new Date();

        await transaction.proposal.update({
          where: { id: proposal.id },
          data: {
            status: ProposalStatus.ACCEPTED,
            acceptedAt,
          },
        });

        await transaction.proposal.updateMany({
          where: {
            serviceRequestId: serviceRequest.id,
            status: ProposalStatus.ACTIVE,
            id: { not: proposal.id },
          },
          data: {
            status: ProposalStatus.REJECTED,
            rejectedAt: acceptedAt,
          },
        });

        const contract = await transaction.contract.create({
          data: {
            serviceRequestId: serviceRequest.id,
            acceptedProposalId: proposal.id,
            customerProfileId: customerProfile.id,
            professionalProfileId: proposal.professionalProfileId,
            agreedAmountInCents: proposal.amountInCents,
            agreedDurationValue: proposal.estimatedDurationValue,
            agreedDurationUnit: proposal.estimatedDurationUnit,
            agreedMessage: proposal.message,
            status: ContractStatus.ACCEPTED,
            acceptedAt,
          },
          select: {
            id: true,
            status: true,
            agreedAmountInCents: true,
            acceptedAt: true,
          },
        });

        const conversation = await transaction.conversation.create({
          data: {
            contractId: contract.id,
            status: ConversationStatus.ACTIVE,
          },
          select: { id: true, status: true },
        });

        await transaction.serviceRequest.update({
          where: { id: serviceRequest.id },
          data: {
            status: ServiceRequestStatus.HIRED,
            hiredAt: acceptedAt,
          },
        });

        return {
          contract,
          conversation,
        } satisfies AcceptProposalResponseProperties;
      });

      return new AcceptProposalResponseDto(result);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ContractAlreadyExistsException();
      }

      throw error;
    }
  }

  async reject(userId: string, proposalId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findUnique({ where: { id: proposalId }, select: { id: true, serviceRequestId: true } });
      if (!proposal) throw new ProposalNotFoundException();
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "service_requests" WHERE "id" = ${proposal.serviceRequestId}::uuid FOR UPDATE`);
      const customer = await transaction.customerProfile.findUnique({ where: { userId }, select: { id: true } });
      const request = customer && await transaction.serviceRequest.findFirst({ where: { id: proposal.serviceRequestId, customerProfileId: customer.id, deletedAt: null, status: { in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.RECEIVING_PROPOSALS, ServiceRequestStatus.IN_NEGOTIATION] } }, select: { id: true } });
      if (!request) throw new ProposalNotFoundException();
      const result = await transaction.proposal.updateMany({ where: { id: proposalId, serviceRequestId: request.id, status: ProposalStatus.ACTIVE, isVisible: true }, data: { status: ProposalStatus.REJECTED, rejectedAt: new Date() } });
      if (result.count !== 1) throw new ProposalNotActiveException();
    });
  }

  async requestNext(userId: string, serviceRequestId: string): Promise<void> {
    await this.withCustomerRequestLock(userId, serviceRequestId, async (transaction, request) => {
      const visible = await transaction.proposal.count({ where: { serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: true } });
      if (visible >= request.visibleProposalLimit) throw new ConflictException("Ainda há propostas visíveis para avaliar.");
      const reserve = await transaction.proposal.findFirst({ where: { serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: false }, orderBy: { submittedAt: "asc" }, select: { id: true } });
      if (reserve) await transaction.proposal.update({ where: { id: reserve.id }, data: { isVisible: true } });
    });
  }

  async increaseVisibleLimit(userId: string, serviceRequestId: string, limit: number): Promise<void> {
    await this.withCustomerRequestLock(userId, serviceRequestId, async (transaction, request) => {
      if (![3, 5, 10].includes(limit) || limit <= request.visibleProposalLimit) throw new ConflictException("O limite só pode aumentar para 5 ou 10 propostas.");
      await transaction.serviceRequest.update({ where: { id: serviceRequestId }, data: { visibleProposalLimit: limit } });
      const visible = await transaction.proposal.count({ where: { serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: true } });
      for (let slot = visible; slot < limit; slot += 1) {
        const reserve = await transaction.proposal.findFirst({ where: { serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: false }, orderBy: { submittedAt: "asc" }, select: { id: true } });
        if (!reserve) break;
        await transaction.proposal.update({ where: { id: reserve.id }, data: { isVisible: true } });
      }
    });
  }

  async withdraw(userId: string, proposalId: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const proposal = await transaction.proposal.findUnique({ where: { id: proposalId }, select: { id: true, serviceRequestId: true, professionalProfile: { select: { userId: true } } } });
      if (!proposal || proposal.professionalProfile.userId !== userId) throw new ProposalNotFoundException();
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "service_requests" WHERE "id" = ${proposal.serviceRequestId}::uuid FOR UPDATE`);
      const current = await transaction.proposal.findUnique({ where: { id: proposalId }, select: { status: true, isVisible: true } });
      if (!current || current.status !== ProposalStatus.ACTIVE) throw new ProposalNotActiveException();
      await transaction.proposal.update({ where: { id: proposalId }, data: { status: ProposalStatus.WITHDRAWN, withdrawnAt: new Date() } });
      if (current.isVisible) {
        const reserve = await transaction.proposal.findFirst({ where: { serviceRequestId: proposal.serviceRequestId, status: ProposalStatus.ACTIVE, isVisible: false }, orderBy: { submittedAt: "asc" }, select: { id: true } });
        if (reserve) await transaction.proposal.update({ where: { id: reserve.id }, data: { isVisible: true } });
      }
    });
  }

  private async withCustomerRequestLock(userId: string, serviceRequestId: string, callback: (transaction: Prisma.TransactionClient, request: { visibleProposalLimit: number }) => Promise<void>): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const customer = await transaction.customerProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!customer) throw new ServiceRequestNotFoundException();
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "service_requests" WHERE "id" = ${serviceRequestId}::uuid FOR UPDATE`);
      const request = await transaction.serviceRequest.findFirst({ where: { id: serviceRequestId, customerProfileId: customer.id, deletedAt: null, status: { in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.RECEIVING_PROPOSALS, ServiceRequestStatus.IN_NEGOTIATION] } }, select: { visibleProposalLimit: true } });
      if (!request) throw new ServiceRequestNotFoundException();
      await callback(transaction, request);
    });
  }
}
