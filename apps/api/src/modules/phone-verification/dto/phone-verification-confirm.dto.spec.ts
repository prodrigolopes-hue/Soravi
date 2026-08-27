import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { PhoneVerificationConfirmDto } from "./phone-verification-confirm.dto";

describe("PhoneVerificationConfirmDto", () => {
  it("aceita exatamente seis dígitos", async () => {
    await expect(validate(createDto({ code: "012345" }))).resolves.toHaveLength(
      0,
    );
  });

  it.each(["12345", "1234567", "12a456", " 123456", ""])(
    "rejeita código inválido %s",
    async (code) => {
      expect(await validate(createDto({ code }))).not.toHaveLength(0);
    },
  );

  it("rejeita campos de identidade com whitelist estrita", async () => {
    const errors = await validate(
      createDto({ code: "012345", userId: "user-id", phone: "+5521999999999" }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(["userId", "phone"]),
    );
  });
});

function createDto(input: Record<string, unknown>): PhoneVerificationConfirmDto {
  return plainToInstance(PhoneVerificationConfirmDto, input);
}
