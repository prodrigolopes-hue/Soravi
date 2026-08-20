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
import { ProposalAlreadyExistsException } from "./errors/proposal-already-exists.exception";
import { ProposalCreationUnavailableException } from "./errors/proposal-creation-unavailable.exception";
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

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

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