import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ActivateCurrentProfessionalProfileDto } from "./activate-current-professional-profile.dto";

describe("ActivateCurrentProfessionalProfileDto", () => {
  const valid = { professionalTitle: "Eletricista", serviceArea: "São Paulo", bio: "Descrição profissional com mais de trinta caracteres.", categorySlugs: ["eletrica"] };
  it("aceita a entrada profissional válida", async () => {
    await expect(validate(plainToInstance(ActivateCurrentProfessionalProfileDto, valid))).resolves.toHaveLength(0);
  });
  it.each([{ professionalTitle: "ab" }, { serviceArea: "a" }, { bio: "curta" }, { categorySlugs: [] }, { categorySlugs: ["a", "a"] }, { categorySlugs: ["a", "b", "c", "d"] }])("rejeita entrada inválida %#", async (override) => {
    await expect(validate(plainToInstance(ActivateCurrentProfessionalProfileDto, { ...valid, ...override }))).resolves.not.toHaveLength(0);
  });
});
