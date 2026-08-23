import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../database/prisma.service";
import { Role, UserStatus } from "../../generated/prisma/client";
import { InvalidAccessTokenException } from "./errors/invalid-access-token.exception";
import { AccessTokenPayload } from "./interfaces/access-token-payload.interface";
import { AuthenticatedUser } from "./interfaces/authenticated-user.interface";

const AUTHENTICATED_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

@Injectable()
export class AccessTokenAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  extractBearerToken(
    authorizationHeader: string | undefined,
  ): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token, ...remainingParts] = authorizationHeader
      .trim()
      .split(/\s+/);

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token ||
      remainingParts.length > 0
    ) {
      return null;
    }

    return token;
  }

  async authenticateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedUser> {
    const payload = await this.verifyAccessToken(accessToken);

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            deletedAt: true,
            status: true,
            roles: {
              select: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new InvalidAccessTokenException();
    }

    if (session.userId !== payload.sub) {
      throw new InvalidAccessTokenException();
    }

    if (session.revokedAt !== null) {
      throw new InvalidAccessTokenException();
    }

    if (session.expiresAt <= new Date()) {
      throw new InvalidAccessTokenException();
    }

    if (!session.user) {
      throw new InvalidAccessTokenException();
    }

    if (session.user.deletedAt !== null) {
      throw new InvalidAccessTokenException();
    }

    if (!AUTHENTICATED_USER_STATUSES.includes(session.user.status)) {
      throw new InvalidAccessTokenException();
    }

    return {
      id: session.userId,
      sessionId: session.id,
      roles: session.user.roles.map(({ role }): Role => role),
    };
  }

  private async verifyAccessToken(
    accessToken: string,
  ): Promise<AccessTokenPayload> {
    try {
      const secret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        accessToken,
        {
          secret,
        },
      );

      if (!this.isValidPayload(payload)) {
        throw new InvalidAccessTokenException();
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof InvalidAccessTokenException) {
        throw error;
      }

      throw new InvalidAccessTokenException();
    }
  }

  private isValidPayload(payload: AccessTokenPayload): boolean {
    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.sessionId === "string" &&
      payload.sessionId.length > 0 &&
      Array.isArray(payload.roles)
    );
  }
}
