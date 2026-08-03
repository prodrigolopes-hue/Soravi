import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

import { PrismaService } from "../../../database/prisma.service";
import {
  Role,
  UserStatus,
} from "../../../generated/prisma/client";
import { InvalidAccessTokenException } from "../errors/invalid-access-token.exception";
import { AccessTokenPayload } from "../interfaces/access-token-payload.interface";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

const AUTHENTICATED_USER_STATUSES: readonly UserStatus[] = [
  UserStatus.PENDING,
  UserStatus.ACTIVE,
];

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const accessToken =
      this.extractBearerToken(request);

    if (!accessToken) {
      throw new InvalidAccessTokenException();
    }

    const payload =
      await this.verifyAccessToken(accessToken);

    const session =
      await this.prisma.authSession.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          user: {
            deletedAt: null,
            status: {
              in: [...AUTHENTICATED_USER_STATUSES],
            },
          },
        },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
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

    request.user = {
      id: session.userId,
      sessionId: session.id,
      roles: session.user.roles.map(
        ({ role }): Role => role,
      ),
    };

    return true;
  }

  private extractBearerToken(
    request: Request,
  ): string | null {
    const authorization =
      request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token, ...remainingParts] =
      authorization.trim().split(/\s+/);

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !token ||
      remainingParts.length > 0
    ) {
      return null;
    }

    return token;
  }

  private async verifyAccessToken(
    accessToken: string,
  ): Promise<AccessTokenPayload> {
    try {
      const secret =
        this.configService.getOrThrow<string>(
          "JWT_ACCESS_SECRET",
        );

      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(
          accessToken,
          {
            secret,
          },
        );

      if (!this.isValidPayload(payload)) {
        throw new InvalidAccessTokenException();
      }

      return payload;
    } catch {
      throw new InvalidAccessTokenException();
    }
  }

  private isValidPayload(
    payload: AccessTokenPayload,
  ): boolean {
    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.sessionId === "string" &&
      payload.sessionId.length > 0 &&
      Array.isArray(payload.roles)
    );
  }
}