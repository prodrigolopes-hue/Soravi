/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../database/prisma.service";
import {
  Role,
  UserStatus,
} from "../../generated/prisma/client";
import { AccessTokenAuthService } from "./access-token-auth.service";
import { InvalidAccessTokenException } from "./errors/invalid-access-token.exception";

describe("AccessTokenAuthService", () => {
  const userId = "525afb87-2b81-4de7-9606-8f382fff3341";
  const sessionId = "725afb87-2b81-4de7-9606-8f382fff3341";
  const verifiedAt = new Date("2026-08-29T12:00:00.000Z");
  let authSessionFindUnique: jest.Mock;
  let service: AccessTokenAuthService;

  beforeEach(() => {
    authSessionFindUnique = jest.fn().mockResolvedValue(
      createSession(verifiedAt),
    );

    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: userId,
        sessionId,
        roles: [Role.CUSTOMER],
      }),
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue("access-secret"),
    };
    const prisma = {
      authSession: {
        findUnique: authSessionFindUnique,
      },
    };

    service = new AccessTokenAuthService(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("seleciona phoneVerifiedAt na consulta existente e retorna o valor atual", async () => {
    await expect(
      service.authenticateAccessToken("access-token"),
    ).resolves.toEqual({
      id: userId,
      sessionId,
      roles: [Role.PROFESSIONAL],
      phoneVerifiedAt: verifiedAt,
    });

    expect(authSessionFindUnique).toHaveBeenCalledWith({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            deletedAt: true,
            status: true,
            phoneVerifiedAt: true,
            roles: {
              select: {
                role: true,
              },
            },
          },
        },
      },
    });
  });

  it("preserva phoneVerifiedAt null e usa os roles atuais do banco", async () => {
    authSessionFindUnique.mockResolvedValue(createSession(null));

    await expect(
      service.authenticateAccessToken("access-token"),
    ).resolves.toEqual({
      id: userId,
      sessionId,
      roles: [Role.PROFESSIONAL],
      phoneVerifiedAt: null,
    });
  });

  it("mantem a rejeicao de sessao revogada", async () => {
    authSessionFindUnique.mockResolvedValue({
      ...createSession(verifiedAt),
      revokedAt: new Date(),
    });

    await expect(
      service.authenticateAccessToken("access-token"),
    ).rejects.toBeInstanceOf(InvalidAccessTokenException);
  });

  function createSession(phoneVerifiedAt: Date | null) {
    return {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        phoneVerifiedAt,
        roles: [{ role: Role.PROFESSIONAL }],
      },
    };
  }
});
