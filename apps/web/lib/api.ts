export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/u, "");

export const launchInterestsUrl = `${normalizedApiBaseUrl}/api/v1/launch-interests`;

export const adminCustomersUrl = `${normalizedApiBaseUrl}/api/v1/users/admin/customers`;

export const adminProfessionalsUrl = `${normalizedApiBaseUrl}/api/v1/users/admin/professionals`;

export const categoriesUrl = `${normalizedApiBaseUrl}/api/v1/categories`;

export const categorySuggestionsUrl = `${normalizedApiBaseUrl}/api/v1/category-suggestions`;

export const adminCategoriesUrl = `${normalizedApiBaseUrl}/api/v1/categories/admin`;

export const adminCategoryRequestsUrl = `${normalizedApiBaseUrl}/api/v1/category-requests/admin`;

export const adminCategorySuggestionsUrl = `${normalizedApiBaseUrl}/api/v1/category-suggestions/admin`;
