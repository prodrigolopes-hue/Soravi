import { ConfigService } from "@nestjs/config";

import { PhoneVerificationCodeService } from "./phone-verification-code.service";

describe("PhoneVerificationCodeService", () => {
  const hmacSecret = "s".repeat(32);
  const context = {
    challengeId: "625afb87-2b81-4de7-9606-8f382fff3341",
    userId: "525afb87-2b81-4de7-9606-8f382fff3341",
    phoneNormalized: "+5521999999999",
    code: "012345",
  };
  let service: PhoneVerificationCodeService;

  beforeEach(() => {
    service = new PhoneVerificationCodeService({
      getOrThrow: jest.fn().mockReturnValue(hmacSecret),
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("gera string com seis dígitos e cobre indiretamente o padStart", () => {
    const mathRandomSpy = jest.spyOn(Math, "random");

    for (let index = 0; index < 100; index += 1) {
      const code = service.generateCode();

      expect(typeof code).toBe("string");
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
    }
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it("produz HMAC SHA-256 determinístico com 64 caracteres hex", () => {
    const firstHash = service.hashCode(context);
    const secondHash = service.hashCode(context);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["code", { code: "012346" }],
    ["challengeId", { challengeId: "other-challenge-id" }],
    ["userId", { userId: "other-user-id" }],
    ["phoneNormalized", { phoneNormalized: "+5511999999999" }],
  ])("altera o hash quando muda %s", (_field, override) => {
    expect(service.hashCode({ ...context, ...override })).not.toBe(
      service.hashCode(context),
    );
  });

  it("valida o código correto", () => {
    expect(
      service.verifyCode({
        ...context,
        expectedHash: service.hashCode(context),
      }),
    ).toBe(true);
  });

  it("rejeita código incorreto", () => {
    expect(
      service.verifyCode({
        ...context,
        code: "999999",
        expectedHash: service.hashCode(context),
      }),
    ).toBe(false);
  });

  it.each(["", "invalid", "f".repeat(63), "g".repeat(64)])(
    "rejeita expectedHash inválido sem lançar erro",
    (expectedHash) => {
      expect(service.verifyCode({ ...context, expectedHash })).toBe(false);
    },
  );

  it("não possui dependência de persistência ou logger", () => {
    const properties = Object.keys(service);

    expect(properties).toEqual(["configService", "hmacSecret"]);
  });
});
