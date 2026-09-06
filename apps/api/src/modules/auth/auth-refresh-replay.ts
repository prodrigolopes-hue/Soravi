export const AUTH_REFRESH_REPLAY_GRACE_PERIOD_MS = 60_000;

export function isWithinAuthRefreshReplayGracePeriod(
  rotatedAt: Date,
  now: Date,
): boolean {
  return (
    rotatedAt.getTime() + AUTH_REFRESH_REPLAY_GRACE_PERIOD_MS >=
    now.getTime()
  );
}
