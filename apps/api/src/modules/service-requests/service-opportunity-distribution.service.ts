import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  CommunicationChannel,
  NotificationType,
  Prisma,
  ProfessionalVerificationStatus,
  ServiceRequestStatus,
} from "../../generated/prisma/client";
import { OutboundNotificationsService } from "../notifications/outbound-notifications.service";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundNotificationsService: OutboundNotificationsService,
  ) {}

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
        select: { id: true, userId: true },
      });

      if (professionals.length === 0) {
        return NOT_DISPATCHED;
      }

      const professionalUserIds = new Map<string, string>();

      for (const professional of professionals) {
        professionalUserIds.set(professional.id, professional.userId);
      }

      const createdOpportunities =
        await transaction.serviceOpportunity.createManyAndReturn({
          data: professionals.map((professional) => ({
            serviceRequestId,
            professionalProfileId: professional.id,
          })),
          skipDuplicates: true,
          select: {
            id: true,
            professionalProfileId: true,
          },
        });

      if (createdOpportunities.length === 0) {
        return NOT_DISPATCHED;
      }

      const notifications = createdOpportunities.map((opportunity) => {
        const professionalUserId = professionalUserIds.get(
          opportunity.professionalProfileId,
        );

        if (!professionalUserId) {
          throw new Error(
            "Profissional da oportunidade criada não encontrado na distribuição.",
          );
        }

        return {
          userId: professionalUserId,
          type: NotificationType.OPPORTUNITY_CREATED,
          title: "Nova oportunidade",
          message: "Uma nova oportunidade está disponível.",
          resourceType: "SERVICE_OPPORTUNITY",
          resourceId: opportunity.id,
        };
      });

      for (const notificationData of notifications) {
        const notification = await transaction.notification.upsert({
          where: {
            userId_type_resourceType_resourceId: {
              userId: notificationData.userId,
              type: notificationData.type,
              resourceType: notificationData.resourceType,
              resourceId: notificationData.resourceId,
            },
          },
          update: {},
          create: notificationData,
          select: { id: true },
        });

        await this.outboundNotificationsService.createPending({
          transaction,
          notificationId: notification.id,
          userId: notificationData.userId,
          channel: CommunicationChannel.WHATSAPP,
          eventType: NotificationType.OPPORTUNITY_CREATED,
        });
      }

      await transaction.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { opportunitiesDispatchedAt: now },
      });

      return {
        dispatched: true,
        opportunitiesCreated: createdOpportunities.length,
      };
    });
  }
}
