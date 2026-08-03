import {
    ExecutionContext,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../../database/prisma.service";
import { Role } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "./access-token.guard";

interface RequestMock {
    headers: {
        authorization?: string;
    };
    user?: {
        id: string;
        sessionId: string;
        roles: Role[];
    };
}

describe("AccessTokenGuard", () => {
    const userId =
        "525afb87-2b81-4de7-9606-8f382fff3341";

    const sessionId =
        "725afb87-2b81-4de7-9606-8f382fff3341";

    let guard: AccessTokenGuard;

    let jwtServiceMock: {
        verifyAsync: jest.Mock;
    };

    let configServiceMock: {
        getOrThrow: jest.Mock;
    };

    let prismaMock: {
        authSession: {
            findFirst: jest.Mock;
        };
    };

    beforeEach(() => {
        jwtServiceMock = {
            verifyAsync: jest.fn(),
        };

        configServiceMock = {
            getOrThrow: jest.fn(),
        };

        prismaMock = {
            authSession: {
                findFirst: jest.fn(),
            },
        };

        configServiceMock.getOrThrow.mockReturnValue(
            "test-access-token-secret-with-at-least-32-characters",
        );

        jwtServiceMock.verifyAsync.mockResolvedValue({
            sub: userId,
            sessionId,
            roles: [Role.CUSTOMER],
        });

        prismaMock.authSession.findFirst.mockResolvedValue({
            id: sessionId,
            userId,
            user: {
                roles: [
                    {
                        role: Role.CUSTOMER,
                    },
                ],
            },
        });

        guard = new AccessTokenGuard(
            jwtServiceMock as unknown as JwtService,
            configServiceMock as unknown as ConfigService,
            prismaMock as unknown as PrismaService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("deve rejeitar requisição sem access token", async () => {
        const request: RequestMock = {
            headers: {},
        };

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
            jwtServiceMock.verifyAsync,
        ).not.toHaveBeenCalled();

        expect(
            prismaMock.authSession.findFirst,
        ).not.toHaveBeenCalled();
    });

    it("deve rejeitar cabeçalho de autorização inválido", async () => {
        const request: RequestMock = {
            headers: {
                authorization: "Basic access-token-test",
            },
        };

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
            jwtServiceMock.verifyAsync,
        ).not.toHaveBeenCalled();
    });

    it("deve rejeitar JWT inválido ou expirado", async () => {
        const request = createAuthenticatedRequest();

        jwtServiceMock.verifyAsync.mockRejectedValue(
            new Error("Token inválido"),
        );

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
            prismaMock.authSession.findFirst,
        ).not.toHaveBeenCalled();
    });

    it("deve rejeitar payload sem identificador de sessão", async () => {
        const request = createAuthenticatedRequest();

        jwtServiceMock.verifyAsync.mockResolvedValue({
            sub: userId,
            roles: [Role.CUSTOMER],
        });

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
            prismaMock.authSession.findFirst,
        ).not.toHaveBeenCalled();
    });

    it("deve rejeitar sessão inexistente ou indisponível", async () => {
        const request = createAuthenticatedRequest();

        prismaMock.authSession.findFirst.mockResolvedValue(
            null,
        );

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("deve autenticar usuário com token e sessão válidos", async () => {
        const request = createAuthenticatedRequest();

        const result = await guard.canActivate(
            createExecutionContext(request),
        );

        expect(result).toBe(true);

        expect(
            configServiceMock.getOrThrow,
        ).toHaveBeenCalledWith(
            "JWT_ACCESS_SECRET",
        );

        expect(
            jwtServiceMock.verifyAsync,
        ).toHaveBeenCalledWith(
            "access-token-test",
            {
                secret:
                    "test-access-token-secret-with-at-least-32-characters",
            },
        );

        expect(
            prismaMock.authSession.findFirst,
        ).toHaveBeenCalledWith({
            where: {
                id: sessionId,
                userId,
                revokedAt: null,
                expiresAt: {
                    gt: expect.any(Date),
                },
                user: {
                    deletedAt: null,
                    status: {
                        in: expect.any(Array),
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

        expect(request.user).toEqual({
            id: userId,
            sessionId,
            roles: [Role.CUSTOMER],
        });
    });

    function createAuthenticatedRequest(): RequestMock {
        return {
            headers: {
                authorization: "Bearer access-token-test",
            },
        };
    }

    function createExecutionContext(
        request: RequestMock,
    ): ExecutionContext {
        return {
            switchToHttp: () => ({
                getRequest: () => request,
                getResponse: jest.fn(),
                getNext: jest.fn(),
            }),
            getClass: jest.fn(),
            getHandler: jest.fn(),
            getArgs: jest.fn(),
            getArgByIndex: jest.fn(),
            switchToRpc: jest.fn(),
            switchToWs: jest.fn(),
            getType: jest.fn(),
        } as unknown as ExecutionContext;
    }
});