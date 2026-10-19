import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { RecordPersonalIdentityDto } from "./record-personal-identity.dto";

describe("RecordPersonalIdentityDto", () => {
  it("accepts a valid formatted CPF", async () => {
    const input = plainToInstance(RecordPersonalIdentityDto, { cpf: " 529.982.247-25 " });
    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.cpf).toBe("529.982.247-25");
  });

  it.each(["123", "000.000.000-00", "5299822472500000"])("rejects invalid CPF input", async (cpf) => {
    const errors = await validate(plainToInstance(RecordPersonalIdentityDto, { cpf }));
    expect(errors).not.toHaveLength(0);
    expect(Object.values(errors[0].constraints ?? {})).toEqual(
      expect.arrayContaining(["CPF invalido."]),
    );
  });
});
