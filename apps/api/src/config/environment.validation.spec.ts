import "reflect-metadata";

import { validateEnvironment } from "./environment.validation";

describe("validateEnvironment", () => {
  const requiredEnvironment = {
    DATABASE_URL: "postgresql://soravi:soravi@localhost:5432/soravi",
    JWT_ACCESS_SECRET: "a-secret-with-at-least-thirty-two-characters",
    PHONE_VERIFICATION_HMAC_SECRET:
      "a-distinct-phone-verification-secret-with-safe-length",
  };
  const completeMetaEnvironment = {
    ...requiredEnvironment,
    PHONE_VERIFICATION_DELIVERY_PROVIDER: "meta",
    META_WHATSAPP_ACCESS_TOKEN: "meta-access-token",
    META_WHATSAPP_PHONE_NUMBER_ID: "123456789",
    META_WHATSAPP_GRAPH_API_VERSION: "v26.0",
    META_WHATSAPP_OTP_TEMPLATE_NAME: "soravi_phone_verification",
    META_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "pt_BR",
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
    expect(environment.PHONE_VERIFICATION_DELIVERY_PROVIDER).toBe(
      "unavailable",
    );
    expect(environment.PASSWORD_RESET_DELIVERY_PROVIDER).toBe("unavailable");
    expect(environment.META_WHATSAPP_HTTP_TIMEOUT_MS).toBe(5_000);
  });

  it("aceita provider unavailable sem configuração Meta", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PHONE_VERIFICATION_DELIVERY_PROVIDER: "unavailable",
        META_WHATSAPP_ACCESS_TOKEN: "",
        META_WHATSAPP_PHONE_NUMBER_ID: "",
        META_WHATSAPP_GRAPH_API_VERSION: "",
        META_WHATSAPP_OTP_TEMPLATE_NAME: "",
        META_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "",
      }),
    ).not.toThrow();
  });

  it("aceita delivery de reset unavailable sem configuração Resend", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PASSWORD_RESET_DELIVERY_PROVIDER: "unavailable",
        RESEND_API_KEY: "",
        PASSWORD_RESET_EMAIL_FROM: "",
        FRONTEND_PUBLIC_URL: "",
      }),
    ).not.toThrow();
  });

  it.each([
    "RESEND_API_KEY",
    "PASSWORD_RESET_EMAIL_FROM",
    "FRONTEND_PUBLIC_URL",
  ])("rejeita configuração Resend obrigatória ausente: %s", (key) => {
    const environment: Record<string, unknown> = {
      ...requiredEnvironment,
      PASSWORD_RESET_DELIVERY_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      PASSWORD_RESET_EMAIL_FROM: "Soravi <nao-responda@example.com>",
      FRONTEND_PUBLIC_URL: "https://app.example.com",
    };
    delete environment[key];

    expect(() => validateEnvironment(environment)).toThrow(
      "Variáveis de ambiente inválidas",
    );
  });

  it("aceita provider Resend com configuração completa", () => {
    const environment = validateEnvironment({
      ...requiredEnvironment,
      PASSWORD_RESET_DELIVERY_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_key",
      PASSWORD_RESET_EMAIL_FROM: "Soravi <nao-responda@example.com>",
      FRONTEND_PUBLIC_URL: "https://app.example.com",
    });

    expect(environment.PASSWORD_RESET_DELIVERY_PROVIDER).toBe("resend");
  });

  it("rejeita URL pública inválida para o frontend", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PASSWORD_RESET_DELIVERY_PROVIDER: "resend",
        RESEND_API_KEY: "re_test_key",
        PASSWORD_RESET_EMAIL_FROM: "Soravi <nao-responda@example.com>",
        FRONTEND_PUBLIC_URL: "app.example.com",
      }),
    ).toThrow("Variáveis de ambiente inválidas");
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
      META_WHATSAPP_HTTP_TIMEOUT_MS: "7000",
    });

    expect(environment.OPPORTUNITY_DISTRIBUTION_INTERVAL_MS).toBe(5_000);
    expect(environment.OPPORTUNITY_DISTRIBUTION_BATCH_SIZE).toBe(12);
    expect(environment.OUTBOUND_NOTIFICATION_INTERVAL_MS).toBe(7_000);
    expect(environment.OUTBOUND_NOTIFICATION_BATCH_SIZE).toBe(15);
    expect(environment.PHONE_VERIFICATION_TTL_SECONDS).toBe(900);
    expect(environment.PHONE_VERIFICATION_MAX_ATTEMPTS).toBe(7);
    expect(environment.PHONE_VERIFICATION_COOLDOWN_SECONDS).toBe(120);
    expect(environment.META_WHATSAPP_HTTP_TIMEOUT_MS).toBe(7_000);
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
    ["META_WHATSAPP_HTTP_TIMEOUT_MS", "999"],
    ["META_WHATSAPP_HTTP_TIMEOUT_MS", "15001"],
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

  it.each([
    "META_WHATSAPP_ACCESS_TOKEN",
    "META_WHATSAPP_PHONE_NUMBER_ID",
    "META_WHATSAPP_GRAPH_API_VERSION",
    "META_WHATSAPP_OTP_TEMPLATE_NAME",
    "META_WHATSAPP_OTP_TEMPLATE_LANGUAGE",
  ])("rejeita configuração Meta obrigatória ausente: %s", (key) => {
    const environment = {
      ...completeMetaEnvironment,
    } as Record<string, unknown>;
    delete environment[key];

    expect(() => validateEnvironment(environment)).toThrow(
      "Variáveis de ambiente inválidas",
    );
  });

  it("aceita provider meta com configuração completa", () => {
    const environment = validateEnvironment(completeMetaEnvironment);

    expect(environment.PHONE_VERIFICATION_DELIVERY_PROVIDER).toBe("meta");
  });

  it("rejeita provider de entrega desconhecido", () => {
    expect(() =>
      validateEnvironment({
        ...requiredEnvironment,
        PHONE_VERIFICATION_DELIVERY_PROVIDER: "unknown",
      }),
    ).toThrow("Variáveis de ambiente inválidas");
  });

  it("rejeita versão implícita da Graph API", () => {
    expect(() =>
      validateEnvironment({
        ...completeMetaEnvironment,
        META_WHATSAPP_GRAPH_API_VERSION: "latest",
      }),
    ).toThrow("Variáveis de ambiente inválidas");
  });
});
