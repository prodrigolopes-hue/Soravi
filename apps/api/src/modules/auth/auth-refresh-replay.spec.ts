import {
  AUTH_REFRESH_REPLAY_GRACE_PERIOD_MS,
  isWithinAuthRefreshReplayGracePeriod,
} from "./auth-refresh-replay";

describe("isWithinAuthRefreshReplayGracePeriod", () => {
  const rotatedAt = new Date("2026-08-01T12:00:00.000Z");

  it("considera dentro do grace period imediatamente após a rotação", () => {
    const now = new Date(rotatedAt.getTime());

    expect(
      isWithinAuthRefreshReplayGracePeriod(rotatedAt, now),
    ).toBe(true);
  });

  it("considera dentro do grace period em exatamente 60 segundos", () => {
    const now = new Date(
      rotatedAt.getTime() + AUTH_REFRESH_REPLAY_GRACE_PERIOD_MS,
    );

    expect(
      isWithinAuthRefreshReplayGracePeriod(rotatedAt, now),
    ).toBe(true);
  });

  it("considera fora do grace period em 60 segundos + 1 ms", () => {
    const now = new Date(
      rotatedAt.getTime() + AUTH_REFRESH_REPLAY_GRACE_PERIOD_MS + 1,
    );

    expect(
      isWithinAuthRefreshReplayGracePeriod(rotatedAt, now),
    ).toBe(false);
  });
});
