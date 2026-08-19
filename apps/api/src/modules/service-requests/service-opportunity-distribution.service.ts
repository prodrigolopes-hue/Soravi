import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  Prisma,
  ProfessionalVerificationStatus,
  ServiceRequestStatus,
} from "../../generated/prisma/client";

export interface ServiceOpportunityDistributionResult {
  dispatched: boolean;
  opportunitiesCreated: number;
}

const NOT_DISPATCHED: ServiceOpportunityDistributionResult = {
  dispatched: false,
  opportunitiesCreated: 0,
};

@Injectable()
export class ServiceOpportunityDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  distribute(
    serviceRequestId: string,
  ): Promise<ServiceOpportunityDistributionResult> {
    const now = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "service_requests"
          WHERE "id" = ${serviceRequestId}::uuid
          FOR UPDATE
        `,
      );

      if (lockedRows.length === 0) {
        return NOT_DISPATCHED;
      }

      const serviceRequest = await transaction.serviceRequest.findFirst({
        where: {
          id: serviceRequestId,
          status: ServiceRequestStatus.OPEN,
          editableUntil: { lte: now },
          opportunitiesDispatchedAt: null,
          deletedAt: null,
        },
        select: { categoryId: true },
      });

      if (!serviceRequest) {
        return NOT_DISPATCHED;
      }

      const professionals = await transaction.professionalProfile.findMany({
        where: {
          deletedAt: null,
          isAvailable: true,
          verificationStatus: ProfessionalVerificationStatus.APPROVED,
          professionalCategories: {
            some: { categoryId: serviceRequest.categoryId },
          },
        },
        select: { id: true },
      });

      if (professionals.length === 0) {
        return NOT_DISPATCHED;
      }

      const created = await transaction.serviceOpportunity.createMany({
        data: professionals.map((professional) => ({
          serviceRequestId,
          professionalProfileId: professional.id,
        })),
        skipDuplicates: true,
      });

      if (created.count === 0) {
        return NOT_DISPATCHED;
      }

      await transaction.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { opportunitiesDispatchedAt: now },
      });

      return {
        dispatched: true,
        opportunitiesCreated: created.count,
      };
    });
  }
}
