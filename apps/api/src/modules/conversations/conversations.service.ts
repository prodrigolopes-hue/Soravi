import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  ConversationStatus,
  MessageStatus,
  Prisma,
} from "../../generated/prisma/client";
import { ConversationResponseDto } from "./dto/conversation-response.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MarkConversationReadDto } from "./dto/mark-conversation-read.dto";
import { MessageListResponseDto } from "./dto/message-list-response.dto";
import { MessageResponseDto } from "./dto/message-response.dto";
import { ConversationNotFoundException } from "./errors/conversation-not-found.exception";

const DEFAULT_MESSAGE_LIMIT = 30;
const MAX_MESSAGE_LIMIT = 100;

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

const MESSAGE_ITEM_SELECT = {
  id: true,
  senderUserId: true,
  content: true,
  status: true,
  sentAt: true,
  editedAt: true,
  deletedAt: true,
} satisfies Prisma.MessageSelect;

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

  async findMessages(
    userId: string,
    conversationId: string,
    before?: string,
    rawLimit?: string,
  ): Promise<MessageListResponseDto> {
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
      select: { id: true },
    });

    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    const limit = this.parseLimit(rawLimit);
    const messageCursor = before
      ? await this.prisma.message.findFirst({
          where: {
            id: before,
            conversationId,
          },
          select: {
            id: true,
            sentAt: true,
          },
        })
      : null;

    if (before && !messageCursor) {
      throw new BadRequestException({
        code: "INVALID_MESSAGE_CURSOR",
        message: "Cursor inválido para a conversa informada.",
      });
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(messageCursor
          ? {
              OR: [
                {
                  sentAt: {
                    lt: messageCursor.sentAt,
                  },
                },
                {
                  sentAt: messageCursor.sentAt,
                  id: {
                    lt: messageCursor.id,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [
        {
          sentAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: limit + 1,
      select: MESSAGE_ITEM_SELECT,
    });

    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;
    const orderedItems = [...pageItems].reverse();

    return new MessageListResponseDto(
      orderedItems,
      hasMore ? orderedItems[0]?.id ?? null : null,
      hasMore,
    );
  }

  async createMessage(
    userId: string,
    conversationId: string,
    input: CreateMessageDto,
  ): Promise<MessageResponseDto> {
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
      select: {
        id: true,
        status: true,
      },
    });

    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    if (
      conversation.status === ConversationStatus.CLOSED ||
      conversation.status === ConversationStatus.BLOCKED
    ) {
      throw new ConflictException({
        code: "CONVERSATION_MESSAGE_BLOCKED",
        message: "Esta conversa não aceita novas mensagens no momento.",
      });
    }

    const createdMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: userId,
        content: input.content.trim(),
        status: MessageStatus.SENT,
        sentAt: new Date(),
        editedAt: null,
        deletedAt: null,
      },
      select: MESSAGE_ITEM_SELECT,
    });

    return new MessageResponseDto(createdMessage);
  }

  async markAsRead(
    userId: string,
    conversationId: string,
    input: MarkConversationReadDto,
  ): Promise<void> {
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
      select: { id: true },
    });

    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    const targetMessage = await this.prisma.message.findFirst({
      where: {
        id: input.lastReadMessageId,
        conversationId,
      },
      select: {
        id: true,
        sentAt: true,
      },
    });

    if (!targetMessage) {
      throw new BadRequestException({
        code: "INVALID_MESSAGE_CURSOR",
        message: "Cursor inválido para a conversa informada.",
      });
    }

    const currentReadState = await this.prisma.conversationReadState.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: {
        lastReadMessage: {
          select: {
            id: true,
            sentAt: true,
          },
        },
      },
    });

    if (
      currentReadState?.lastReadMessage &&
      this.isMessageBefore(targetMessage, currentReadState.lastReadMessage)
    ) {
      throw new ConflictException({
        code: "READ_STATE_CANNOT_RETROCEDE",
        message: "O ponto de leitura não pode retroceder.",
      });
    }

    const lastReadAt = new Date();

    await this.prisma.conversationReadState.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        lastReadMessageId: targetMessage.id,
        lastReadAt,
      },
      update: {
        lastReadMessageId: targetMessage.id,
        lastReadAt,
      },
    });
  }

  private parseLimit(rawLimit?: string): number {
    const candidate = rawLimit ?? String(DEFAULT_MESSAGE_LIMIT);
    const value = Number.parseInt(candidate, 10);

    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException({
        code: "INVALID_MESSAGE_LIMIT",
        message: "Parâmetro limit inválido.",
      });
    }

    return Math.min(value, MAX_MESSAGE_LIMIT);
  }

  private isMessageBefore(
    candidate: { id: string; sentAt: Date },
    current: { id: string; sentAt: Date },
  ): boolean {
    if (candidate.sentAt.getTime() !== current.sentAt.getTime()) {
      return candidate.sentAt.getTime() < current.sentAt.getTime();
    }

    return candidate.id < current.id;
  }
}
