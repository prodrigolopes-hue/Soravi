import "reflect-metadata";

import { EstimatedDurationUnit, Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { ProposalsController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";

describe("ProposalsController", () => {
  const proposalsServiceMock = { create: jest.fn() };
  const controller = new ProposalsController(
    proposalsServiceMock as unknown as ProposalsService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha profissional, solicitação e payload ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.PROFESSIONAL],
    };
    const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";
    const dto: CreateProposalDto = {
      amountInCents: 15000,
      estimatedDurationValue: 2,
      estimatedDurationUnit: EstimatedDurationUnit.HOUR,
      message: "Posso realizar amanhã.",
    };
    const response = { id: "proposal-id" };
    proposalsServiceMock.create.mockResolvedValue(response);

    const result = await controller.create(currentUser, serviceRequestId, dto);

    expect(proposalsServiceMock.create).toHaveBeenCalledWith(
      currentUser.id,
      serviceRequestId,
      dto,
    );
    expect(result).toBe(response);
  });

  it("protege a criação com autenticação e role PROFESSIONAL", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ProposalsController.prototype.create,
    );
    const roles = Reflect.getMetadata(
      "roles",
      ProposalsController.prototype.create,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    expect(roles).toEqual([Role.PROFESSIONAL]);
  });
});