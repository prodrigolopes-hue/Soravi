import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ProposalStatus } from "../../../generated/prisma/client";
import { ProposalsReceivedQueryDto } from "./proposals-received-query.dto";

describe("ProposalsReceivedQueryDto", () => {
  it("aceita filtros e paginação válidos", async () => {
    const query = plainToInstance(ProposalsReceivedQueryDto, {
      status: ProposalStatus.ACTIVE,
      page: "2",
      limit: "10",
      sort: "asc",
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toEqual({
      status: ProposalStatus.ACTIVE,
      page: 2,
      limit: 10,
      sort: "asc",
    });
  });

  it.each([
    ["status", "INVALID"],
    ["page", "0"],
    ["limit", "101"],
    ["sort", "newest"],
  ])("rejeita %s inválido", async (field, value) => {
    const query = plainToInstance(ProposalsReceivedQueryDto, {
      [field]: value,
    });
    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toContain(field);
  });

  it("rejeita customerProfileId com whitelist estrita", async () => {
    const query = plainToInstance(ProposalsReceivedQueryDto, {
      customerProfileId: "425afb87-2b81-4de7-9606-8f382fff3341",
    });
    const errors = await validate(query, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toContain(
      "customerProfileId",
    );
  });
});