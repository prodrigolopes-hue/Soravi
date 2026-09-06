interface AuthRefreshLockManager {
  request<T>(name: string, operation: () => Promise<T>): Promise<T>;
}

export async function runWithAuthRefreshLock<T>(
  operation: () => Promise<T>,
  lockManager: AuthRefreshLockManager | null | undefined =
    typeof navigator !== "undefined" ? navigator.locks : undefined,
): Promise<T> {
  if (!lockManager) {
    return operation();
  }

  return lockManager.request("soravi-auth-refresh", operation);
}
