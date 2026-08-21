import { MessageStatus } from "../../../generated/prisma/client";

export interface MessageResponseDtoProperties {
  id: string;
  senderUserId: string;
  content: string;
  status: MessageStatus;
  sentAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export class MessageResponseDto {
  readonly id: string;
  readonly senderUserId: string;
  readonly content: string;
  readonly status: MessageStatus;
  readonly sentAt: Date;
  readonly editedAt: Date | null;
  readonly deletedAt: Date | null;

  constructor(properties: MessageResponseDtoProperties) {
    this.id = properties.id;
    this.senderUserId = properties.senderUserId;
    this.content = properties.content;
    this.status = properties.status;
    this.sentAt = properties.sentAt;
    this.editedAt = properties.editedAt;
    this.deletedAt = properties.deletedAt;
  }
}
