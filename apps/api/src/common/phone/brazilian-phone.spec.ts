import { normalizeBrazilianPhoneToE164 } from "./brazilian-phone";

describe("normalizeBrazilianPhoneToE164", () => {
  it.each([
    ["(21) 99999-9999", "+5521999999999"],
    ["21 99999-9999", "+5521999999999"],
    ["21999999999", "+5521999999999"],
    ["+55 21 99999-9999", "+5521999999999"],
    ["5521999999999", "+5521999999999"],
    ["(21) 3333-4444", "+552133334444"],
  ])("normaliza %s para %s", (input, expected) => {
    expect(normalizeBrazilianPhoneToE164(input)).toBe(expected);
  });

  it.each([
    "99999-9999",
    "219999999",
    "55219999999999",
    "+54 21 99999-9999",
    "telefone (21) 99999-9999",
    "",
    "   ",
    "()+-",
    "00 99999-9999",
    "21 1999-9999",
    "21 89999-9999",
  ])("rejeita %s", (input) => {
    expect(normalizeBrazilianPhoneToE164(input)).toBeNull();
  });
});
