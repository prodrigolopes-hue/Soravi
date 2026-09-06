import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  type CookieOptions,
  type Request,
  type Response,
} from "express";

import { AuthService } from "./auth.service";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { PasswordResetConfirmDto } from "./dto/password-reset-confirm.dto";
import { PasswordResetRequestDto } from "./dto/password-reset-request.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RegisterResponseDto } from "./dto/register-response.dto";
import { RegisterUserDto } from "./dto/register-user.dto";
import { PasswordResetService } from "./password-reset.service";

const PASSWORD_RESET_REQUEST_RESPONSE = {
  message: "Se existir uma conta com este e-mail, enviaremos as instruções.",
} as const;

@Controller("auth")
export class AuthController {
  private readonly refreshTokenCookieName = "soravi_refresh_token";

  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) { }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async requestPasswordReset(
    @Body() input: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    await this.passwordResetService.requestReset(input.email);

    return PASSWORD_RESET_REQUEST_RESPONSE;
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async confirmPasswordReset(
    @Body() input: PasswordResetConfirmDto,
  ): Promise<void> {
    await this.passwordResetService.confirmReset(
      input.token,
      input.newPassword,
    );
  }

  @Post("register")
  register(
    @Body() input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    return this.authService.register(input);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 900_000 } })
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

    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  private getRefreshTokenCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
    };
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
        ...this.getRefreshTokenCookieOptions(),
        expires: expiresAt,
      },
    );
  }

  private clearRefreshTokenCookie(
    response: Response,
  ): void {
    response.clearCookie(
      this.refreshTokenCookieName,
      this.getRefreshTokenCookieOptions(),
    );
  }
}
