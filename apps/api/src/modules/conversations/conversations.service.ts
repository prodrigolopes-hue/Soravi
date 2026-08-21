import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

const CONVERSATION_SELECT = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  contract: {
    select: {
      id: true,
      status: true,
      agreedAmountInCents: true,
      agreedDurationValue: true,
      agreedDurationUnit: true,
      acceptedAt: true,
      customerProfile: {
        select: {
          userId: true,
        },
      },
      professionalProfile: {
        select: {
          userId: true,
        },
      },
      serviceRequest: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.ConversationSelect;

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        contract: {
          OR: [
            {
              customerProfile: {
                userId,
              },
            },
            {
              professionalProfile: {
                userId,
              },
            },
          ],
        },
      },
      select: CONVERSATION_SELECT,
    });

    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    const contract = conversation.contract;
    const participantRole: "CUSTOMER" | "PROFESSIONAL" =
      contract.customerProfile.userId === userId ? "CUSTOMER" : "PROFESSIONAL";

    return new ConversationResponseDto({
      id: conversation.id,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      closedAt: conversation.closedAt,
      contract: {
        id: contract.id,
        status: contract.status,
        agreedAmountInCents: contract.agreedAmountInCents,
        agreedDurationValue: contract.agreedDurationValue,
        agreedDurationUnit: contract.agreedDurationUnit,
        acceptedAt: contract.acceptedAt,
      },
      serviceRequest: {
        id: contract.serviceRequest.id,
        title: contract.serviceRequest.title,
        status: contract.serviceRequest.status,
      },
      participantRole,
    });
  }
}
