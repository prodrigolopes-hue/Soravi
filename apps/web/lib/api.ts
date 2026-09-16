// A URL pública da API é definida separadamente por ambiente de deploy.
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/u, "");

export const launchInterestsUrl = `${normalizedApiBaseUrl}/api/v1/launch-interests`;

export const adminCustomersUrl = `${normalizedApiBaseUrl}/api/v1/users/admin/customers`;

export const adminProfessionalsUrl = `${normalizedApiBaseUrl}/api/v1/users/admin/professionals`;

export const categoriesUrl = `${normalizedApiBaseUrl}/api/v1/categories`;

export const serviceRequestsUrl = `${normalizedApiBaseUrl}/api/v1/service-requests`;

export const myServiceRequestsUrl = `${serviceRequestsUrl}/mine`;

export const opportunitiesUrl = `${normalizedApiBaseUrl}/api/v1/opportunities`;

export const conversationsUrl = `${normalizedApiBaseUrl}/api/v1/conversations`;

export const notificationsUrl = `${normalizedApiBaseUrl}/api/v1/notifications`;

export const notificationsUnreadCountUrl = `${notificationsUrl}/unread-count`;

export const notificationsUpdatedEventName = "notifications-updated";

export type NotificationType =
  | "OPPORTUNITY_CREATED"
  | "PROPOSAL_CREATED"
  | "MESSAGE_CREATED";

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsListResponse {
  items: NotificationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationsUnreadCountResponse {
  count: number;
}

export type ConversationStatus = "ACTIVE" | "CLOSED" | "BLOCKED";

export interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  updatedAt: string;
  serviceRequest: {
    id: string;
    title: string;
  };
  contract: {
    status: string;
  };
  lastMessage: {
    id: string;
    senderUserId: string;
    content: string;
    status: string;
    sentAt: string;
  } | null;
  hasUnread: boolean;
}

export interface ConversationsListResponse {
  items: ConversationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function conversationsListUrl(page: number, limit: number): string {
  return `${conversationsUrl}?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
}

export function notificationsListUrl(page: number, limit: number): string {
  return `${notificationsUrl}?page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
}

export function parseNotificationsUnreadCountResponse(
  payload: unknown,
): NotificationsUnreadCountResponse | null {
  if (!isRecord(payload) || !isNonNegativeInteger(payload.count)) {
    return null;
  }

  return { count: payload.count };
}

export function notificationReadUrl(notificationId: string): string {
  return `${notificationsUrl}/${encodeURIComponent(notificationId)}/read`;
}

export function parseNotificationsListResponse(
  payload: unknown,
): NotificationsListResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  const root = isRecord(payload.data) ? payload.data : payload;

  if (!Array.isArray(root.items) || !isRecord(root.pagination)) {
    return null;
  }

  const items: NotificationListItem[] = [];

  for (const value of root.items) {
    const item = parseNotificationListItem(value);

    if (!item) {
      return null;
    }

    items.push(item);
  }

  const { page, limit, total, totalPages } = root.pagination;

  if (
    !isPositiveInteger(page) ||
    !isPositiveInteger(limit) ||
    !isNonNegativeInteger(total) ||
    !isNonNegativeInteger(totalPages)
  ) {
    return null;
  }

  return { items, pagination: { page, limit, total, totalPages } };
}

function parseNotificationListItem(
  value: unknown,
): NotificationListItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isNotificationType(value.type) ||
    typeof value.title !== "string" ||
    typeof value.message !== "string" ||
    typeof value.resourceType !== "string" ||
    typeof value.resourceId !== "string" ||
    (typeof value.href !== "string" && value.href !== null) ||
    (typeof value.readAt !== "string" && value.readAt !== null) ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    title: value.title,
    message: value.message,
    resourceType: value.resourceType,
    resourceId: value.resourceId,
    href: value.href,
    readAt: value.readAt,
    createdAt: value.createdAt,
  };
}

function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === "OPPORTUNITY_CREATED" ||
    value === "PROPOSAL_CREATED" ||
    value === "MESSAGE_CREATED"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function opportunityByIdUrl(opportunityId: string): string {
  return `${opportunitiesUrl}/${encodeURIComponent(opportunityId)}`;
}

export function conversationByIdUrl(conversationId: string): string {
  return `${conversationsUrl}/${encodeURIComponent(conversationId)}`;
}

export function conversationMessagesUrl(conversationId: string): string {
  return `${conversationByIdUrl(conversationId)}/messages`;
}

export function conversationReadUrl(conversationId: string): string {
  return `${conversationByIdUrl(conversationId)}/read`;
}

export function opportunityViewedUrl(opportunityId: string): string {
  return `${opportunityByIdUrl(opportunityId)}/viewed`;
}

export function serviceRequestByIdUrl(serviceRequestId: string): string {
  return `${serviceRequestsUrl}/${encodeURIComponent(serviceRequestId)}`;
}

export function proposalCreateUrl(serviceRequestId: string): string {
  return `${serviceRequestByIdUrl(serviceRequestId)}/proposals`;
}

export function serviceRequestProposalsUrl(serviceRequestId: string): string {
  return `${serviceRequestByIdUrl(serviceRequestId)}/proposals`;
}

export function proposalAcceptUrl(proposalId: string): string {
  return `${normalizedApiBaseUrl}/api/v1/proposals/${encodeURIComponent(proposalId)}/accept`;
}

export function contractStartUrl(contractId: string): string {
  return `${normalizedApiBaseUrl}/api/v1/contracts/${encodeURIComponent(contractId)}/start`;
}

export function contractCompleteUrl(contractId: string): string {
  return `${normalizedApiBaseUrl}/api/v1/contracts/${encodeURIComponent(contractId)}/complete`;
}

export function serviceRequestPhotosUrl(serviceRequestId: string): string {
  return `${serviceRequestByIdUrl(serviceRequestId)}/photos`;
}

export function serviceRequestCancelUrl(serviceRequestId: string): string {
  return `${serviceRequestByIdUrl(serviceRequestId)}/cancel`;
}

export const categorySuggestionsUrl = `${normalizedApiBaseUrl}/api/v1/category-suggestions`;

export const adminCategoriesUrl = `${normalizedApiBaseUrl}/api/v1/categories/admin`;

export const adminCategoryRequestsUrl = `${normalizedApiBaseUrl}/api/v1/category-requests/admin`;

export const adminCategorySuggestionsUrl = `${normalizedApiBaseUrl}/api/v1/category-suggestions/admin`;

export function adminCategorySuggestionByIdUrl(id: string): string {
  return `${normalizedApiBaseUrl}/api/v1/category-suggestions/admin/${id}`;
}
