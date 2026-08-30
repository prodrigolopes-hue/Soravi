import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateCurrentUserPhoneDto } from "./update-current-user-phone.dto";

describe("UpdateCurrentUserPhoneDto", () => {
  it("aceita telefone brasileiro e preserva a senha exatamente", async () => {
    const dto = plainToInstance(UpdateCurrentUserPhoneDto, {
      phone: "  (21) 99999-9999  ",
      currentPassword: " senha com espaços ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.phone).toBe("(21) 99999-9999");
    expect(dto.currentPassword).toBe(" senha com espaços ");
  });

  it.each([
    {},
    { phone: "99999-9999", currentPassword: "senha" },
    { phone: "(21) 99999-9999" },
  ])("rejeita body inválido %#", async (body) => {
    const errors = await validate(
      plainToInstance(UpdateCurrentUserPhoneDto, body),
    );

    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejeita campos sensíveis controlados pelo cliente", async () => {
    const dto = plainToInstance(UpdateCurrentUserPhoneDto, {
      phone: "(21) 99999-9999",
      currentPassword: "senha",
      userId: "outro-usuario",
      role: "ADMIN",
      phoneVerifiedAt: new Date().toISOString(),
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(["userId", "role", "phoneVerifiedAt"]),
    );
  });
});
