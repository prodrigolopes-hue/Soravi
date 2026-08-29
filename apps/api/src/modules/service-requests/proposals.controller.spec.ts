import "reflect-metadata";

import { EstimatedDurationUnit, Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { ProposalsReceivedQueryDto } from "./dto/proposals-received-query.dto";
import { ProposalsController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";

describe("ProposalsController", () => {
  const proposalsServiceMock = {
    create: jest.fn(),
    findReceived: jest.fn(),
  };
  const controller = new ProposalsController(
    proposalsServiceMock as unknown as ProposalsService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha cliente, solicitação e query para listar propostas", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.CUSTOMER],
      phoneVerifiedAt: null,
    };
    const serviceRequestId = "725afb87-2b81-4de7-9606-8f382fff3341";
    const query = new ProposalsReceivedQueryDto();
    const response = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    proposalsServiceMock.findReceived.mockResolvedValue(response);

    const result = await controller.findReceived(
      currentUser,
      serviceRequestId,
      query,
    );

    expect(proposalsServiceMock.findReceived).toHaveBeenCalledWith(
      currentUser.id,
      serviceRequestId,
      query,
    );
    expect(result).toBe(response);
  });

  it("protege a listagem com autenticação e role CUSTOMER", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      ProposalsController.prototype.findReceived,
    );
    const roles = Reflect.getMetadata(
      "roles",
      ProposalsController.prototype.findReceived,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    expect(roles).toEqual([Role.CUSTOMER]);
  });

  it("encaminha profissional, solicitação e payload ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.PROFESSIONAL],
      phoneVerifiedAt: null,
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
