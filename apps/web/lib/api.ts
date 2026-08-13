export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const launchInterestsUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/launch-interests`;

export const adminCustomersUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/users/admin/customers`;

export const adminProfessionalsUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/users/admin/professionals`;

export const adminCategoriesUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/categories/admin`;

export const adminCategoryRequestsUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/category-requests/admin`;
