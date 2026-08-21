import { MessageStatus } from "../../../generated/prisma/client";

export interface MessageListItemProperties {
  id: string;
  senderUserId: string;
  content: string;
  status: MessageStatus;
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export class MessageListResponseDto {
  readonly data: MessageListItemProperties[];
  readonly meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };

  constructor(
    items: MessageListItemProperties[],
    nextCursor: string | null,
    hasMore: boolean,
  ) {
    this.data = items;
    this.meta = {
      nextCursor,
      hasMore,
    };
  }
}
