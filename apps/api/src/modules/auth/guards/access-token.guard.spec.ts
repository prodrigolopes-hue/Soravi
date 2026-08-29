/// <reference types="jest" />

import "reflect-metadata";

import {
    ExecutionContext,
    UnauthorizedException,
} from "@nestjs/common";

import { Role } from "../../../generated/prisma/client";
import { AccessTokenAuthService } from "../access-token-auth.service";
import { AccessTokenGuard } from "./access-token.guard";

interface RequestMock {
    headers: {
        authorization?: string;
    };
    user?: {
        id: string;
        sessionId: string;
        roles: Role[];
        phoneVerifiedAt: Date | null;
    };
}

describe("AccessTokenGuard", () => {
    let guard: AccessTokenGuard;

    let accessTokenAuthServiceMock: {
        extractBearerToken: jest.Mock;
        authenticateAccessToken: jest.Mock;
    };

    beforeEach(() => {
        accessTokenAuthServiceMock = {
            extractBearerToken: jest.fn(),
            authenticateAccessToken: jest.fn(),
        };

        guard = new AccessTokenGuard(
            accessTokenAuthServiceMock as unknown as AccessTokenAuthService,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("deve rejeitar requisição sem access token", async () => {
        const request: RequestMock = {
            headers: {},
        };

        accessTokenAuthServiceMock.extractBearerToken.mockReturnValue(null);

        await expect(
            guard.canActivate(createExecutionContext(request)),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
            accessTokenAuthServiceMock.authenticateAccessToken,
        ).not.toHaveBeenCalled();
    });


    it("deve autenticar usuário com token e sessão válidos", async () => {
        const request = createAuthenticatedRequest();

        accessTokenAuthServiceMock.extractBearerToken.mockReturnValue(
            "access-token-test",
        );

        accessTokenAuthServiceMock.authenticateAccessToken.mockResolvedValue({
            id: "525afb87-2b81-4de7-9606-8f382fff3341",
            sessionId: "725afb87-2b81-4de7-9606-8f382fff3341",
            roles: [Role.CUSTOMER],
            phoneVerifiedAt: null,
        });

        const result = await guard.canActivate(
            createExecutionContext(request),
        );

        expect(result).toBe(true);

        expect(
            accessTokenAuthServiceMock.extractBearerToken,
        ).toHaveBeenCalledWith("Bearer access-token-test");

        expect(
            accessTokenAuthServiceMock.authenticateAccessToken,
        ).toHaveBeenCalledWith("access-token-test");

        expect(request.user).toEqual({
            id: "525afb87-2b81-4de7-9606-8f382fff3341",
            sessionId: "725afb87-2b81-4de7-9606-8f382fff3341",
            roles: [Role.CUSTOMER],
            phoneVerifiedAt: null,
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
