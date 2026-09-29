import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateCurrentProfessionalProfileDto } from "./update-current-professional-profile.dto";

describe("UpdateCurrentProfessionalProfileDto", () => {
  it("normaliza campos opcionais vazios para null", async () => {
    const dto = plainToInstance(UpdateCurrentProfessionalProfileDto, {
      ...validBody(),
      professionalTitle: "   ",
      serviceArea: " ",
      bio: "\n\t",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.professionalTitle).toBeNull();
    expect(dto.serviceArea).toBeNull();
    expect(dto.bio).toBeNull();
  });

  it.each([
    { categorySlugs: [] },
    { categorySlugs: ["eletrica", "pintura", "limpeza", "jardinagem"] },
    { categorySlugs: ["eletrica", " eletrica "] },
    { displayName: "A" },
    { isAvailable: "true" },
  ])("rejeita entrada inválida %#", async (overrides) => {
    const dto = plainToInstance(UpdateCurrentProfessionalProfileDto, {
      ...validBody(),
      ...overrides,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

function validBody() {
  return {
    displayName: "Maria Serviços",
    categorySlugs: ["eletrica"],
    isAvailable: true,
  };
}
