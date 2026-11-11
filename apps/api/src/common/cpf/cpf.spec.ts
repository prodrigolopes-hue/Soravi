import { CpfValidationError, normalizeCpf } from "./cpf";

describe("normalizeCpf", () => {
  it.each([
    ["52998224725", "52998224725"],
    ["529.982.247-25", "52998224725"],
    ["  529.982.247-25  ", "52998224725"],
  ])("normaliza %s para a representação canônica", (input, expected) => {
    expect(normalizeCpf(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "529 982 247 25",
    "529.982.247/25",
    "529.982.247-2a",
    "529.982.247-2",
    "11111111111",
    "52998224724",
  ])("rejeita %s", (input) => {
    expect(() => normalizeCpf(input)).toThrow(CpfValidationError);
  });
});
