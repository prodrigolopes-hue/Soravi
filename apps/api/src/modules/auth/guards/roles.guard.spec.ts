import {
    ExecutionContext,
    ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { Role } from "../../../generated/prisma/client";
import { RolesGuard } from "./roles.guard";

interface RequestMock {
    user?: {
        id: string;
        sessionId: string;
        roles: Role[];
    };
}

describe("RolesGuard", () => {
    const userId =
        "525afb87-2b81-4de7-9606-8f382fff3341";

    const sessionId =
        "725afb87-2b81-4de7-9606-8f382fff3341";

    let guard: RolesGuard;

    let reflectorMock: {
        getAllAndOverride: jest.Mock;
    };

    beforeEach(() => {
        reflectorMock = {
            getAllAndOverride: jest.fn(),
        };

        guard = new RolesGuard(
            reflectorMock as unknown as Reflector,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("deve permitir rota sem papéis declarados", () => {
        reflectorMock.getAllAndOverride.mockReturnValue(
            undefined,
        );

        const result = guard.canActivate(
            createExecutionContext({}),
        );

        expect(result).toBe(true);
    });

    it("deve rejeitar quando não há usuário autenticado", () => {
        reflectorMock.getAllAndOverride.mockReturnValue([
            Role.PROFESSIONAL,
        ]);

        expect(() =>
            guard.canActivate(
                createExecutionContext({}),
            ),
        ).toThrow(ForbiddenException);
    });

    it("deve rejeitar usuário sem o papel exigido", () => {
        reflectorMock.getAllAndOverride.mockReturnValue([
            Role.PROFESSIONAL,
        ]);

        const request: RequestMock = {
            user: {
                id: userId,
                sessionId,
                roles: [Role.CUSTOMER],
            },
        };

        expect(() =>
            guard.canActivate(
                createExecutionContext(request),
            ),
        ).toThrow(ForbiddenException);
    });

    it("deve permitir usuário com o papel exigido", () => {
        reflectorMock.getAllAndOverride.mockReturnValue([
            Role.PROFESSIONAL,
        ]);

        const request: RequestMock = {
            user: {
                id: userId,
                sessionId,
                roles: [Role.PROFESSIONAL],
            },
        };

        const result = guard.canActivate(
            createExecutionContext(request),
        );

        expect(result).toBe(true);
    });

    it("deve permitir usuário com um dos papéis aceitos", () => {
        reflectorMock.getAllAndOverride.mockReturnValue([
            Role.MODERATOR,
            Role.ADMIN,
        ]);

        const request: RequestMock = {
            user: {
                id: userId,
                sessionId,
                roles: [Role.ADMIN],
            },
        };

        const result = guard.canActivate(
            createExecutionContext(request),
        );

        expect(result).toBe(true);
    });

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