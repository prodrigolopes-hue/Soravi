import "reflect-metadata";
import { HEADERS_METADATA } from "@nestjs/common/constants";

import { PublicProfessionalDiscoveryQueryDto } from "./dto/public-professional-discovery-query.dto";
import { ProfessionalDiscoveryController } from "./professional-discovery.controller";
import { ProfessionalDiscoveryService } from "./professional-discovery.service";

describe("ProfessionalDiscoveryController", () => {
  const professionalDiscoveryServiceMock = {
    findByCategory: jest.fn(),
    findOne: jest.fn(),
  };
  const controller = new ProfessionalDiscoveryController(
    professionalDiscoveryServiceMock as unknown as ProfessionalDiscoveryService,
  );

  afterEach(() => jest.clearAllMocks());

  it("encaminha a categoria e paginação sem exigir sessão", async () => {
    const query = new PublicProfessionalDiscoveryQueryDto();
    const response = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    professionalDiscoveryServiceMock.findByCategory.mockResolvedValue(response);

    await expect(controller.findByCategory("eletrica", query)).resolves.toBe(response);
    expect(professionalDiscoveryServiceMock.findByCategory).toHaveBeenCalledWith("eletrica", query);
    expect(Reflect.getMetadata("__guards__", ProfessionalDiscoveryController.prototype.findByCategory)).toBeUndefined();
  });

  it("encaminha o identificador público do perfil sem exigir sessão", async () => {
    const query = new PublicProfessionalDiscoveryQueryDto();
    const response = { id: "725afb87-2b81-4de7-9606-8f382fff3341" };
    professionalDiscoveryServiceMock.findOne.mockResolvedValue(response);

    await expect(controller.findOne(response.id, query)).resolves.toBe(response);
    expect(professionalDiscoveryServiceMock.findOne).toHaveBeenCalledWith(response.id, query);
    expect(Reflect.getMetadata("__guards__", ProfessionalDiscoveryController.prototype.findOne)).toBeUndefined();
  });

  it("desabilita cache para URLs temporárias", () => {
    for (const handler of [
      ProfessionalDiscoveryController.prototype.findByCategory,
      ProfessionalDiscoveryController.prototype.findOne,
    ]) {
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Cache-Control", value: "no-store" }),
        ]),
      );
    }
  });
});
