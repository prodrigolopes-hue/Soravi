import { Injectable } from "@nestjs/common";

import {
  Prisma,
  ProfessionalVerificationStatus,
  ProposalStatus,
  Role,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
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
import { ProposalAlreadyExistsException } from "./errors/proposal-already-exists.exception";
import { ProposalCreationUnavailableException } from "./errors/proposal-creation-unavailable.exception";
import { ServiceRequestNotFoundException } from "./errors/service-request-not-found.exception";
import { ServiceRequestNotAcceptingProposalsException } from "./errors/service-request-not-accepting-proposals.exception";

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
} satisfies Prisma.ProposalSelect;

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return new ProposalsReceivedListResponseDto(
      proposals as ProposalReceivedProperties[],
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
          select: { status: true },
        });

        if (!serviceRequest) {
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
          serviceRequest.status !== ServiceRequestStatus.OPEN &&
          serviceRequest.status !== ServiceRequestStatus.RECEIVING_PROPOSALS
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

        const createdProposal = await transaction.proposal.create({
          data: {
            serviceRequestId,
            professionalProfileId: professionalProfile.id,
            amountInCents: dto.amountInCents,
            estimatedDurationValue: dto.estimatedDurationValue,
            estimatedDurationUnit: dto.estimatedDurationUnit,
            message: dto.message,
            status: ProposalStatus.ACTIVE,
            acceptedAt: null,
            rejectedAt: null,
            withdrawnAt: null,
            expiredAt: null,
          },
          select: PROPOSAL_RESPONSE_SELECT,
        });

        if (serviceRequest.status === ServiceRequestStatus.OPEN) {
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
}