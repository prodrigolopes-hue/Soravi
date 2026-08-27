import "reflect-metadata";

import { validateEnvironment } from "./environment.validation";

describe("validateEnvironment", () => {
  const requiredEnvironment = {
    DATABASE_URL: "postgresql://soravi:soravi@localhost:5432/soravi",
    JWT_ACCESS_SECRET: "a-secret-with-at-least-thirty-two-characters",
    PHONE_VERIFICATION_HMAC_SECRET:
      "a-distinct-phone-verification-secret-with-safe-length",
  };

  it("aplica os defaults da distribuição de oportunidades", () => {
    const environment = validateEnvironment(requiredEnvironment);

    expect(environment.OPPORTUNITY_DISTRIBUTION_INTERVAL_MS).toBe(60_000);
    expect(environment.OPPORTUNITY_DISTRIBUTION_BATCH_SIZE).toBe(50);
    expect(environment.OUTBOUND_NOTIFICATION_INTERVAL_MS).toBe(60_000);
    expect(environment.OUTBOUND_NOTIFICATION_BATCH_SIZE).toBe(25);
    expect(environment.PHONE_VERIFICATION_TTL_SECONDS).toBe(600);
    expect(environment.PHONE_VERIFICATION_MAX_ATTEMPTS).toBe(5);
    expect(environment.PHONE_VERIFICATION_COOLDOWN_SECONDS).toBe(60);
  });

  it("converte valores configurados para números", () => {
    const environment = validateEnvironment({
      ...requiredEnvironment,
      OPPORTUNITY_DISTRIBUTION_INTERVAL_MS: "5000",
      OPPORTUNITY_DISTRIBUTION_BATCH_SIZE: "12",
      OUTBOUND_NOTIFICATION_INTERVAL_MS: "7000",
      OUTBOUND_NOTIFICATION_BATCH_SIZE: "15",
      PHONE_VERIFICATION_TTL_SECONDS: "900",
      PHONE_VERIFICATION_MAX_ATTEMPTS: "7",
      PHONE_VERIFICATION_COOLDOWN_SECONDS: "120",
    });

    expect(environment.OPPORTUNITY_DISTRIBUTION_INTERVAL_MS).toBe(5_000);
    expect(environment.OPPORTUNITY_DISTRIBUTION_BATCH_SIZE).toBe(12);
    expect(environment.OUTBOUND_NOTIFICATION_INTERVAL_MS).toBe(7_000);
    expect(environment.OUTBOUND_NOTIFICATION_BATCH_SIZE).toBe(15);
    expect(environment.PHONE_VERIFICATION_TTL_SECONDS).toBe(900);
    expect(environment.PHONE_VERIFICATION_MAX_ATTEMPTS).toBe(7);
    expect(environment.PHONE_VERIFICATION_COOLDOWN_SECONDS).toBe(120);
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
    ["PHONE_VERIFICATION_TTL_SECONDS", "59"],
    ["PHONE_VERIFICATION_TTL_SECONDS", "3601"],
    ["PHONE_VERIFICATION_MAX_ATTEMPTS", "0"],
    ["PHONE_VERIFICATION_MAX_ATTEMPTS", "11"],
    ["PHONE_VERIFICATION_COOLDOWN_SECONDS", "9"],
    ["PHONE_VERIFICATION_COOLDOWN_SECONDS", "3601"],
  ])("rejeita %s fora dos limites", (key, value) => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        [key]: value,
      }),
    ).toThrow("Variáveis de ambiente inválidas");
  });

  it("rejeita secret de verificação de telefone ausente", () => {
    const { PHONE_VERIFICATION_HMAC_SECRET: _secret, ...environment } =
      requiredEnvironment;

    expect(() => validateEnvironment(environment)).toThrow(
      "Variáveis de ambiente inválidas",
    );
  });

  it("rejeita secret de verificação de telefone curto", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PHONE_VERIFICATION_HMAC_SECRET: "short-secret",
      }),
    ).toThrow("Variáveis de ambiente inválidas");
  });

  it("rejeita reutilização do JWT_ACCESS_SECRET", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PHONE_VERIFICATION_HMAC_SECRET:
          requiredEnvironment.JWT_ACCESS_SECRET,
      }),
    ).toThrow("deve ser diferente de JWT_ACCESS_SECRET");
  });
});
