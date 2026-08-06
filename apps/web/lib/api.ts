export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const launchInterestsUrl = `${apiBaseUrl.replace(/\/+$/u, "")}/api/v1/launch-interests`;
