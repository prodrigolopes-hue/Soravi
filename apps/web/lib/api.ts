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
