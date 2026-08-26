import "reflect-metadata";

import { validateEnvironment } from "./environment.validation";

describe("validateEnvironment", () => {
  const requiredEnvironment = {
    DATABASE_URL: "postgresql://soravi:soravi@localhost:5432/soravi",
    JWT_ACCESS_SECRET: "a-secret-with-at-least-thirty-two-characters",
  };

  it("aplica os defaults da distribuição de oportunidades", () => {
    const environment = validateEnvironment(requiredEnvironment);

    expect(environment.OPPORTUNITY_DISTRIBUTION_INTERVAL_MS).toBe(60_000);
    expect(environment.OPPORTUNITY_DISTRIBUTION_BATCH_SIZE).toBe(50);
    expect(environment.OUTBOUND_NOTIFICATION_INTERVAL_MS).toBe(60_000);
    expect(environment.OUTBOUND_NOTIFICATION_BATCH_SIZE).toBe(25);
  });

  it("converte valores configurados para números", () => {
    const environment = validateEnvironment({
      ...requiredEnvironment,
      OPPORTUNITY_DISTRIBUTION_INTERVAL_MS: "5000",
      OPPORTUNITY_DISTRIBUTION_BATCH_SIZE: "12",
      OUTBOUND_NOTIFICATION_INTERVAL_MS: "7000",
      OUTBOUND_NOTIFICATION_BATCH_SIZE: "15",
    });

    expect(environment.OPPORTUNITY_DISTRIBUTION_INTERVAL_MS).toBe(5_000);
    expect(environment.OPPORTUNITY_DISTRIBUTION_BATCH_SIZE).toBe(12);
    expect(environment.OUTBOUND_NOTIFICATION_INTERVAL_MS).toBe(7_000);
    expect(environment.OUTBOUND_NOTIFICATION_BATCH_SIZE).toBe(15);
  });

  it.each([
    ["OPPORTUNITY_DISTRIBUTION_INTERVAL_MS", "999"],
    ["OPPORTUNITY_DISTRIBUTION_INTERVAL_MS", "86400001"],
    ["OPPORTUNITY_DISTRIBUTION_BATCH_SIZE", "0"],
    ["OPPORTUNITY_DISTRIBUTION_BATCH_SIZE", "501"],
    ["OUTBOUND_NOTIFICATION_INTERVAL_MS", "999"],
    ["OUTBOUND_NOTIFICATION_INTERVAL_MS", "86400001"],
    ["OUTBOUND_NOTIFICATION_BATCH_SIZE", "0"],
    ["OUTBOUND_NOTIFICATION_BATCH_SIZE", "501"],
  ])("rejeita %s fora dos limites", (key, value) => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        [key]: value,
      }),
    ).toThrow("Variáveis de ambiente inválidas");
  });
});
