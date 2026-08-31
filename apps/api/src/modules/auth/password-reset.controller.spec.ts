import "reflect-metadata";

import { HttpStatus } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordResetService } from "./password-reset.service";

describe("AuthController password reset", () => {
  const authServiceMock = {};
  const passwordResetServiceMock = {
    requestReset: jest.fn(),
    confirmReset: jest.fn(),
  };
  const controller = new AuthController(
    authServiceMock as unknown as AuthService,
    passwordResetServiceMock as unknown as PasswordResetService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("request delega email normalizado e sempre retorna resposta neutra", async () => {
    await expect(
      controller.requestPasswordReset({ email: "maria@example.com" }),
    ).resolves.toEqual({
      message: "Se existir uma conta com este e-mail, enviaremos as instruções.",
    });
    expect(passwordResetServiceMock.requestReset).toHaveBeenCalledWith(
      "maria@example.com",
    );
  });

  it("confirm delega somente token e nova senha e não retorna body", async () => {
    await expect(
      controller.confirmPasswordReset({
        token: "a".repeat(43),
        newPassword: "SenhaSegura1",
      }),
    ).resolves.toBeUndefined();
    expect(passwordResetServiceMock.confirmReset).toHaveBeenCalledWith(
      "a".repeat(43),
      "SenhaSegura1",
    );
  });

  it.each([
    ["requestPasswordReset", HttpStatus.ACCEPTED, 3],
    ["confirmPasswordReset", HttpStatus.NO_CONTENT, 10],
  ] as const)("configura status, guard e rate limit em %s", (method, status, limit) => {
    const handler = AuthController.prototype[method];
    const throttleValues = Reflect.getMetadataKeys(handler)
      .filter((key) => String(key).toLowerCase().includes("throttler"))
      .map((key) => Reflect.getMetadata(key, handler));

    expect(Reflect.getMetadata("__httpCode__", handler)).toBe(status);
    expect(Reflect.getMetadata("__guards__", handler)).toEqual([
      ThrottlerGuard,
    ]);
    expect(throttleValues).toEqual(
      expect.arrayContaining([limit, 900_000]),
    );
  });
});
