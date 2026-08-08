import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { type Request, type Response } from "express";

import { AuthService } from "./auth.service";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";
import { RegisterUserDto } from "./dto/register-user.dto";

@Controller("auth")
export class AuthController {
  private readonly refreshTokenCookieName = "soravi_refresh_token";

  constructor(
    private readonly authService: AuthService,
  ) { }

  @Post("register")
  register(
    @Body() input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(input);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() input: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result =
      await this.authService.loginWithSession(input);

    this.setRefreshTokenCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return result.response;
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken =
      this.getRefreshTokenFromRequest(request);

    if (!refreshToken) {
      throw new UnauthorizedException(
        "Sessão inválida ou expirada.",
      );
    }

    const result =
      await this.authService.refreshWithSession({
        refreshToken,
      });

    this.setRefreshTokenCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return result.response;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken =
      this.getRefreshTokenFromRequest(request);

    if (refreshToken) {
      await this.authService.logout({
        refreshToken,
      });
    }

    this.clearRefreshTokenCookie(response);
  }

  private getRefreshTokenFromRequest(
    request: Request,
  ): string | null {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return null;
    }

    const refreshCookie = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) =>
        cookie.startsWith(
          `${this.refreshTokenCookieName}=`,
        ),
      );

    if (!refreshCookie) {
      return null;
    }

    const separatorIndex = refreshCookie.indexOf("=");

    if (separatorIndex === -1) {
      return null;
    }

    const rawValue = refreshCookie.slice(
      separatorIndex + 1,
    );

    return rawValue
      ? decodeURIComponent(rawValue)
      : null;
  }

  private setRefreshTokenCookie(
    response: Response,
    refreshToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(
      this.refreshTokenCookieName,
      refreshToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      },
    );
  }

  private clearRefreshTokenCookie(
    response: Response,
  ): void {
    response.clearCookie(
      this.refreshTokenCookieName,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    );
  }
}