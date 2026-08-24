import {
  ContractStatus,
  ConversationStatus,
  MessageStatus,
} from "../../../generated/prisma/client";

export interface ConversationListLastMessageProperties {
  id: string;
  senderUserId: string;
  content: string;
  status: MessageStatus;
  sentAt: Date;
}

export interface ConversationListItemProperties {
  id: string;
  status: ConversationStatus;
  updatedAt: Date;
  serviceRequest: {
    id: string;
    title: string;
  };
  contract: {
    status: ContractStatus;
  };
  lastMessage: ConversationListLastMessageProperties | null;
  hasUnread: boolean;
}

export class ConversationListItemResponseDto {
  readonly id: string;
  readonly status: ConversationStatus;
  readonly updatedAt: Date;
  readonly serviceRequest: { id: string; title: string };
  readonly contract: { status: ContractStatus };
  readonly lastMessage: ConversationListLastMessageProperties | null;
  readonly hasUnread: boolean;

  constructor(properties: ConversationListItemProperties) {
    this.id = properties.id;
    this.status = properties.status;
    this.updatedAt = properties.updatedAt;
    this.serviceRequest = properties.serviceRequest;
    this.contract = properties.contract;
    this.lastMessage = properties.lastMessage;
    this.hasUnread = properties.hasUnread;
  }
}

export class ConversationsListPaginationResponseDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class ConversationsListResponseDto {
  items!: ConversationListItemResponseDto[];
  pagination!: ConversationsListPaginationResponseDto;

  constructor(
    items: ConversationListItemProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new ConversationListItemResponseDto(item),
    );
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
