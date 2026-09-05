import "reflect-metadata";

import { UnauthorizedException } from "@nestjs/common";
import { type Request, type Response } from "express";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordResetService } from "./password-reset.service";

describe("AuthController sessions", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const authServiceMock = {
    loginWithSession: jest.fn(),
    refreshWithSession: jest.fn(),
    logout: jest.fn(),
  };
  const controller = new AuthController(
    authServiceMock as unknown as AuthService,
    {} as PasswordResetService,
  );

  afterEach(() => {
    jest.clearAllMocks();

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("login delega, configura cookie seguro e retorna somente a resposta", async () => {
    process.env.NODE_ENV = "test";
    const input = {
      email: "maria@example.com",
      password: "SenhaSegura1",
    };
    const expiresAt = new Date("2026-10-04T12:00:00.000Z");
    const publicResponse = {
      data: {
        user: { id: "user-id" },
        accessToken: "access-token",
        accessTokenExpiresIn: 900,
      },
    };
    authServiceMock.loginWithSession.mockResolvedValue({
      response: publicResponse,
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: expiresAt,
    });
    const response = createResponseMock();

    await expect(controller.login(input, response)).resolves.toBe(
      publicResponse,
    );
    expect(authServiceMock.loginWithSession).toHaveBeenCalledWith(input);
    expect(response.cookie).toHaveBeenCalledWith(
      "soravi_refresh_token",
      "refresh-token",
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
        expires: expiresAt,
      },
    );
    expect(publicResponse).not.toHaveProperty("refreshToken");
  });

  it("login usa cookie secure em production", async () => {
    process.env.NODE_ENV = "production";
    const expiresAt = new Date("2026-10-04T12:00:00.000Z");
    authServiceMock.loginWithSession.mockResolvedValue({
      response: { data: {} },
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: expiresAt,
    });
    const response = createResponseMock();

    await controller.login(
      { email: "maria@example.com", password: "SenhaSegura1" },
      response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      "soravi_refresh_token",
      "refresh-token",
      expect.objectContaining({ secure: true }),
    );
  });

  it("refresh lê cookie, delega rotação e grava o novo token", async () => {
    process.env.NODE_ENV = "test";
    const expiresAt = new Date("2026-10-04T12:00:00.000Z");
    const publicResponse = {
      data: {
        accessToken: "rotated-access-token",
        accessTokenExpiresIn: 900,
      },
    };
    authServiceMock.refreshWithSession.mockResolvedValue({
      response: publicResponse,
      refreshToken: "rotated-refresh-token",
      refreshTokenExpiresAt: expiresAt,
    });
    const response = createResponseMock();

    await expect(
      controller.refresh(
        createRequest("other=value; soravi_refresh_token=encoded%20token"),
        response,
      ),
    ).resolves.toBe(publicResponse);
    expect(authServiceMock.refreshWithSession).toHaveBeenCalledWith({
      refreshToken: "encoded token",
    });
    expect(response.cookie).toHaveBeenCalledWith(
      "soravi_refresh_token",
      "rotated-refresh-token",
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
        expires: expiresAt,
      },
    );
  });

  it("refresh rejeita cookie percent-encoded malformado sem delegar", async () => {
    await expect(
      controller.refresh(
        createRequest("soravi_refresh_token=%E0%A4%A"),
        createResponseMock(),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authServiceMock.refreshWithSession).not.toHaveBeenCalled();
  });

  it("logout revoga a sessão e limpa o cookie com as mesmas opções", async () => {
    process.env.NODE_ENV = "test";
    const response = createResponseMock();

    await expect(
      controller.logout(
        createRequest("soravi_refresh_token=refresh-token"),
        response,
      ),
    ).resolves.toBeUndefined();
    expect(authServiceMock.logout).toHaveBeenCalledWith({
      refreshToken: "refresh-token",
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      "soravi_refresh_token",
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/api/v1/auth",
      },
    );
  });

  it.each([
    ["sem cookie", undefined],
    ["com cookie malformado", "soravi_refresh_token=%E0%A4%A"],
  ])("logout %s não revoga e ainda limpa o cookie", async (_case, cookie) => {
    const response = createResponseMock();

    await expect(
      controller.logout(createRequest(cookie), response),
    ).resolves.toBeUndefined();
    expect(authServiceMock.logout).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalledWith(
      "soravi_refresh_token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/v1/auth",
      }),
    );
  });
});

function createRequest(cookie?: string): Request {
  return {
    headers: cookie === undefined ? {} : { cookie },
  } as unknown as Request;
}

function createResponseMock(): Response {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}
