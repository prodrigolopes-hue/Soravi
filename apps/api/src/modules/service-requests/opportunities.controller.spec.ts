import "reflect-metadata";

import { Role } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OpportunitiesQueryDto } from "./dto/opportunities-query.dto";
import { OpportunitiesController } from "./opportunities.controller";
import { OpportunitiesService } from "./opportunities.service";

describe("OpportunitiesController", () => {
  const opportunitiesServiceMock = {
    findMine: jest.fn(),
    findOneMine: jest.fn(),
  };
  const controller = new OpportunitiesController(
    opportunitiesServiceMock as unknown as OpportunitiesService,
  );

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("encaminha o profissional autenticado e a query ao service", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.PROFESSIONAL],
    };
    const query = new OpportunitiesQueryDto();
    const response = {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    opportunitiesServiceMock.findMine.mockResolvedValue(response);

    const result = await controller.findMine(currentUser, query);

    expect(opportunitiesServiceMock.findMine).toHaveBeenCalledWith(
      currentUser.id,
      query,
    );
    expect(result).toBe(response);
  });

  it("protege a listagem com autenticação e role PROFESSIONAL", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      OpportunitiesController.prototype.findMine,
    );
    const roles = Reflect.getMetadata(
      "roles",
      OpportunitiesController.prototype.findMine,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    expect(roles).toEqual([Role.PROFESSIONAL]);
  });

  it("encaminha o profissional autenticado e o ID ao detalhe", async () => {
    const currentUser = {
      id: "user-id",
      sessionId: "session-id",
      roles: [Role.PROFESSIONAL],
    };
    const opportunityId = "725afb87-2b81-4de7-9606-8f382fff3341";
    const response = { opportunityId };
    opportunitiesServiceMock.findOneMine.mockResolvedValue(response);

    const result = await controller.findOneMine(currentUser, opportunityId);

    expect(opportunitiesServiceMock.findOneMine).toHaveBeenCalledWith(
      currentUser.id,
      opportunityId,
    );
    expect(result).toBe(response);
  });

  it("protege o detalhe com autenticação e role PROFESSIONAL", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      OpportunitiesController.prototype.findOneMine,
    );
    const roles = Reflect.getMetadata(
      "roles",
      OpportunitiesController.prototype.findOneMine,
    );

    expect(guards).toEqual([AccessTokenGuard, RolesGuard]);
    expect(roles).toEqual([Role.PROFESSIONAL]);
  });
});