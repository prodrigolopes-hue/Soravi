import { NotificationType } from "../../../generated/prisma/client";

export interface NotificationListItemProperties {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export class NotificationListItemResponseDto {
  id!: string;
  type!: NotificationType;
  title!: string;
  message!: string;
  resourceType!: string;
  resourceId!: string;
  href!: string | null;
  readAt!: Date | null;
  createdAt!: Date;

  constructor(properties: NotificationListItemProperties) {
    this.id = properties.id;
    this.type = properties.type;
    this.title = properties.title;
    this.message = properties.message;
    this.resourceType = properties.resourceType;
    this.resourceId = properties.resourceId;
    this.href = properties.href;
    this.readAt = properties.readAt;
    this.createdAt = properties.createdAt;
  }
}

export class NotificationsPaginationResponseDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
}

export class NotificationsListResponseDto {
  items!: NotificationListItemResponseDto[];
  pagination!: NotificationsPaginationResponseDto;

  constructor(
    items: NotificationListItemProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map((item) => new NotificationListItemResponseDto(item));
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
