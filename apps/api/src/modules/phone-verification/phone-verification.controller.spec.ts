import "reflect-metadata";

import { HttpStatus } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerificationController } from "./phone-verification.controller";
import { PhoneVerificationService } from "./phone-verification.service";

describe("PhoneVerificationController", () => {
  const serviceMock = {
    requestChallenge: jest.fn(),
    confirmCode: jest.fn(),
  };
  const controller = new PhoneVerificationController(
    serviceMock as unknown as PhoneVerificationService,
  );
  const currentUser = {
    id: "525afb87-2b81-4de7-9606-8f382fff3341",
    sessionId: "session-id",
    roles: [Role.CUSTOMER],
    phoneVerifiedAt: null,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("request usa apenas currentUser e retorna resposta neutra", async () => {
    await expect(controller.requestChallenge(currentUser)).resolves.toEqual({
      accepted: true,
    });
    expect(serviceMock.requestChallenge).toHaveBeenCalledWith(currentUser.id);
  });

  it("confirm usa apenas currentUser e code e não retorna dados", async () => {
    await expect(
      controller.confirmCode(currentUser, { code: "012345" }),
    ).resolves.toBeUndefined();
    expect(serviceMock.confirmCode).toHaveBeenCalledWith(
      currentUser.id,
      "012345",
    );
  });

  it.each(["requestChallenge", "confirmCode"] as const)(
    "protege %s com autenticação e throttling",
    (method) => {
      expect(
        Reflect.getMetadata(
          "__guards__",
          PhoneVerificationController.prototype[method],
        ),
      ).toEqual([AccessTokenGuard, ThrottlerGuard]);
    },
  );

  it("configura status públicos", () => {
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        PhoneVerificationController.prototype.requestChallenge,
      ),
    ).toBe(HttpStatus.ACCEPTED);
    expect(
      Reflect.getMetadata(
        "__httpCode__",
        PhoneVerificationController.prototype.confirmCode,
      ),
    ).toBe(HttpStatus.NO_CONTENT);
  });

  it("configura limites distintos nos dois endpoints", () => {
    expect(
      getThrottlerMetadataValues(
        PhoneVerificationController.prototype.requestChallenge,
      ),
    ).toEqual(expect.arrayContaining([3, 600_000]));
    expect(
      getThrottlerMetadataValues(
        PhoneVerificationController.prototype.confirmCode,
      ),
    ).toEqual(expect.arrayContaining([10, 600_000]));
  });
});

function getThrottlerMetadataValues(
  method: PhoneVerificationController["requestChallenge"] | PhoneVerificationController["confirmCode"],
): unknown[] {
  return Reflect.getMetadataKeys(method)
    .filter((key) => String(key).toLowerCase().includes("throttler"))
    .map((key) => Reflect.getMetadata(key, method));
}
