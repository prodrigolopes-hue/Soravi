import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ProposalAcceptanceController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";

describe("ProposalAcceptanceController", () => {
  const proposalsServiceMock = {
    accept: jest.fn(),
  };
  const controller = new ProposalAcceptanceController(
    proposalsServiceMock as unknown as ProposalsService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o cliente e a proposta ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };
    const response = { data: { contract: {}, conversation: {} } };
    proposalsServiceMock.accept.mockResolvedValue(response);

    const result = await controller.accept(currentUser, "proposal-id");

    expect(proposalsServiceMock.accept).toHaveBeenCalledWith(
      currentUser.id,
      "proposal-id",
    );
    expect(result).toBe(response);
  });

  it("protege o aceite com autenticação e role CUSTOMER", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ProposalAcceptanceController.prototype.accept,
    );
    const roles = Reflect.getMetadata(
      "roles",
      ProposalAcceptanceController.prototype.accept,
    );

    expect(guards).toEqual([
      AccessTokenGuard,
      RolesGuard,
      PhoneVerifiedGuard,
    ]);
    expect(roles).toEqual([Role.CUSTOMER]);
  });
});
