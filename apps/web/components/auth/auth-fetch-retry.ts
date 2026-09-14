export interface RefreshedSession {
  accessToken: string;
}

export function createAuthenticatedFetch(
  fetchImplementation: typeof fetch,
  apiBaseUrl: string,
  refreshSession: () => Promise<RefreshedSession | null>,
): typeof fetch {
  const apiOrigin = new URL(apiBaseUrl).origin;

  return async (input, init) => {
    const response = await fetchImplementation(input, init);

    if (
      response.status !== 401 ||
      !isAuthenticatedApiRequest(input, init, apiOrigin)
    ) {
      return response;
    }

    const refreshedSession = await refreshSession();

    if (!refreshedSession) {
      return response;
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("Authorization", `Bearer ${refreshedSession.accessToken}`);

    return fetchImplementation(input, { ...init, headers });
  };
}

function isAuthenticatedApiRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  apiOrigin: string,
): boolean {
  const url = new URL(
    input instanceof Request ? input.url : input.toString(),
    typeof window === "undefined" ? apiOrigin : window.location.origin,
  );

  if (url.origin !== apiOrigin || url.pathname === "/api/v1/auth/refresh") {
    return false;
  }

  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );

  return headers.get("Authorization")?.startsWith("Bearer ") ?? false;
}
