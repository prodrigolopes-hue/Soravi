/// <reference types="jest" />

import {
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

import { Role } from "../../../generated/prisma/client";
import { PhoneVerificationRequiredException } from "../errors/phone-verification-required.exception";
import { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { PhoneVerifiedGuard } from "./phone-verified.guard";

describe("PhoneVerifiedGuard", () => {
  const guard = new PhoneVerifiedGuard();

  it.each([Role.CUSTOMER, Role.PROFESSIONAL])(
    "permite %s com telefone verificado",
    (role) => {
      expect(
        guard.canActivate(
          createExecutionContext(createUser([role], new Date())),
        ),
      ).toBe(true);
    },
  );

  it.each([Role.CUSTOMER, Role.PROFESSIONAL])(
    "bloqueia %s sem telefone verificado",
    (role) => {
      expect(() =>
        guard.canActivate(
          createExecutionContext(createUser([role], null)),
        ),
      ).toThrow(PhoneVerificationRequiredException);
    },
  );

  it.each([null, new Date()] as const)(
    "permite ADMIN com phoneVerifiedAt %s",
    (phoneVerifiedAt) => {
      expect(
        guard.canActivate(
          createExecutionContext(
            createUser([Role.ADMIN], phoneVerifiedAt),
          ),
        ),
      ).toBe(true);
    },
  );

  it("permite usuario com multiplos roles incluindo ADMIN", () => {
    expect(
      guard.canActivate(
        createExecutionContext(
          createUser([Role.CUSTOMER, Role.ADMIN], null),
        ),
      ),
    ).toBe(true);
  });

  it("retorna 403 estavel sem detalhes sensiveis", () => {
    try {
      guard.canActivate(
        createExecutionContext(createUser([Role.CUSTOMER], null)),
      );
      throw new Error("O guard deveria ter bloqueado a requisicao.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PhoneVerificationRequiredException);

      const response = (
        error as PhoneVerificationRequiredException
      ).getResponse();

      expect(response).toEqual({
        statusCode: 403,
        code: "PHONE_VERIFICATION_REQUIRED",
        message: "Verifique seu telefone para continuar.",
      });
      expect(JSON.stringify(response)).not.toMatch(
        /\+55|challenge|whatsapp|meta/iu,
      );
    }
  });

  it("falha de forma segura quando AccessTokenGuard nao populou request.user", () => {
    expect(() =>
      guard.canActivate(createExecutionContext()),
    ).toThrow(ForbiddenException);
  });

  function createUser(
    roles: Role[],
    phoneVerifiedAt: Date | null,
  ): AuthenticatedUser {
    return {
      id: "525afb87-2b81-4de7-9606-8f382fff3341",
      sessionId: "725afb87-2b81-4de7-9606-8f382fff3341",
      roles,
      phoneVerifiedAt,
    };
  }

  function createExecutionContext(
    user?: AuthenticatedUser,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
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
