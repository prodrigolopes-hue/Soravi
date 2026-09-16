import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

describe("ContractsController", () => {
  const contractsService = { start: jest.fn(), complete: jest.fn() };
  const controller = new ContractsController(contractsService as unknown as ContractsService);
  const user = { id: "user", sessionId: "session", roles: [Role.PROFESSIONAL], phoneVerifiedAt: new Date() };

  afterEach(() => jest.clearAllMocks());

  it("encaminha start e complete para o service", async () => {
    contractsService.start.mockResolvedValue({}); contractsService.complete.mockResolvedValue({});
    await controller.start(user, "11111111-1111-4111-8111-111111111111");
    await controller.complete(user, "11111111-1111-4111-8111-111111111111");
    expect(contractsService.start).toHaveBeenCalledWith(user.id, expect.any(String));
    expect(contractsService.complete).toHaveBeenCalledWith(user.id, expect.any(String));
  });

  it.each([["start", Role.PROFESSIONAL], ["complete", Role.CUSTOMER]] as const)("protege %s pela role correta", (method, role) => {
    expect(Reflect.getMetadata("__guards__", ContractsController.prototype[method])).toEqual([AccessTokenGuard, RolesGuard, PhoneVerifiedGuard]);
    expect(Reflect.getMetadata("roles", ContractsController.prototype[method])).toEqual([role]);
  });
});
