import {
  Body,
  Controller,
  Headers,
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
import { EmailVerificationService } from "./email-verification.service";
import { EmailVerificationConfirmDto } from "./dto/email-verification-confirm.dto";
import { AccessTokenAuthService } from "./access-token-auth.service";

const PASSWORD_RESET_REQUEST_RESPONSE = {
  message: "Se existir uma conta com este e-mail, enviaremos as instruções.",
} as const;
const EMAIL_VERIFICATION_REQUEST_RESPONSE = {
  message: "Se existir uma conta nao confirmada com este e-mail, enviaremos as instrucoes.",
} as const;

@Controller("auth")
export class AuthController {
  private readonly refreshTokenCookieName = "soravi_refresh_token";

  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly accessTokenAuthService: AccessTokenAuthService,
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

  @Post("email-verification/request")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async requestEmailVerification(
    @Body() input: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    await this.emailVerificationService.requestVerification(input.email);
    return EMAIL_VERIFICATION_REQUEST_RESPONSE;
  }

  @Post("email-verification/confirm")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async confirmEmailVerification(
    @Body() input: EmailVerificationConfirmDto,
    @Headers("authorization") authorization: string | undefined,
  ): Promise<{ data: { currentSessionMatches: boolean | null } }> {
    const currentUser = await this.authenticateCurrentSession(authorization);
    const confirmedUserId = await this.emailVerificationService.confirm(input.token);
    return {
      data: {
        currentSessionMatches: currentUser === null ? null : currentUser.id === confirmedUserId,
      },
    };
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async register(
    @Body() input: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    const result = await this.authService.register(input);
    // A conta criada continua utilizavel mesmo se a entrega ainda nao estiver
    // configurada ou falhar; o usuario pode pedir novo link posteriormente.
    await this.emailVerificationService
      .sendForRegisteredUser(result.data.id)
      .catch(() => undefined);
    return result;
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

  private async authenticateCurrentSession(
    authorization: string | undefined,
  ): Promise<{ id: string } | null> {
    const accessToken = this.accessTokenAuthService.extractBearerToken(authorization);
    if (!accessToken) return null;

    try {
      return await this.accessTokenAuthService.authenticateAccessToken(accessToken);
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
