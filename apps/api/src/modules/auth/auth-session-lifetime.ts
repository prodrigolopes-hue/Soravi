export const AUTH_SESSION_ABSOLUTE_LIFETIME_DAYS = 90;

export function getAuthSessionAbsoluteExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() +
      AUTH_SESSION_ABSOLUTE_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function capAuthSessionExpiresAt(
  slidingExpiresAt: Date,
  absoluteExpiresAt: Date,
): Date {
  return new Date(
    Math.min(slidingExpiresAt.getTime(), absoluteExpiresAt.getTime()),
  );
}
