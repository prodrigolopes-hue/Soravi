import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  createHash,
  randomBytes,
} from "node:crypto";

import { Role } from "../../generated/prisma/client";
import { AccessTokenPayload } from "./interfaces/access-token-payload.interface";

interface CreateAuthenticationTokensInput {
  userId: string;
  sessionId: string;
  roles: Role[];
}

interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthTokensService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createTokens(
    input: CreateAuthenticationTokensInput,
  ): Promise<AuthenticationTokens> {
    const accessTokenSecret =
      this.configService.getOrThrow<string>(
        "JWT_ACCESS_SECRET",
      );

    const accessTokenExpiresIn =
      this.configService.get<number>(
        "JWT_ACCESS_EXPIRES_IN_SECONDS",
        900,
      );

    const refreshTokenExpiresInDays =
      this.configService.get<number>(
        "JWT_REFRESH_EXPIRES_IN_DAYS",
        30,
      );

    const payload: AccessTokenPayload = {
      sub: input.userId,
      sessionId: input.sessionId,
      roles: input.roles,
    };

    const accessToken = await this.jwtService.signAsync(
      payload,
      {
        secret: accessTokenSecret,
        expiresIn: accessTokenExpiresIn,
      },
    );

    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash =
      this.hashRefreshToken(refreshToken);

    const refreshTokenExpiresAt = new Date(
      Date.now() +
        refreshTokenExpiresInDays *
          24 *
          60 *
          60 *
          1000,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      accessTokenExpiresIn,
      refreshTokenExpiresAt,
    };
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash("sha256")
      .update(refreshToken)
      .digest("hex");
  }
}