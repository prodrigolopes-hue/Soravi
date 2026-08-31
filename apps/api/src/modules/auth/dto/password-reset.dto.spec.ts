import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { PasswordResetConfirmDto } from "./password-reset-confirm.dto";
import { PasswordResetRequestDto } from "./password-reset-request.dto";

describe("Password reset DTOs", () => {
  it("normaliza email como o cadastro e aceita somente o campo público", async () => {
    const dto = plainToInstance(PasswordResetRequestDto, {
      email: "  Maria@Example.COM  ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe("maria@example.com");
  });

  it.each(["userId", "status", "role"])(
    "rejeita campo extra %s no request",
    async (field) => {
      const dto = plainToInstance(PasswordResetRequestDto, {
        email: "maria@example.com",
        [field]: "não permitido",
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map(({ property }) => property)).toContain(field);
    },
  );

  it.each([
    "SenhaSegura1",
    `${"a".repeat(127)}1`,
  ])("aceita nova senha da política vigente", async (newPassword) => {
    await expect(
      validate(createConfirmDto(newPassword)),
    ).resolves.toHaveLength(0);
  });

  it.each([
    "Curta1",
    "somenteletras",
    "123456789012",
    `${"a".repeat(128)}1`,
  ])("rejeita nova senha fora da política: %s", async (newPassword) => {
    expect(await validate(createConfirmDto(newPassword))).not.toHaveLength(0);
  });

  it("aceita token base64url válido com exatamente 43 caracteres", async () => {
    const dto = createConfirmDto("SenhaSegura1");
    dto.token = `${"Aa0-_".repeat(8)}Aa0`;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ["42 caracteres", "a".repeat(42)],
    ["44 caracteres", "a".repeat(44)],
    ["caractere +", `${"a".repeat(42)}+`],
    ["caractere /", `${"a".repeat(42)}/`],
    ["caractere =", `${"a".repeat(42)}=`],
    ["espaço", `${"a".repeat(21)} ${"a".repeat(21)}`],
    ["outro caractere inválido", `${"a".repeat(42)}!`],
  ])(
    "rejeita token base64url inválido: %s",
    async (_case, token) => {
      const dto = createConfirmDto("SenhaSegura1");
      dto.token = token;

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it.each(["email", "userId", "passwordHash", "status"])(
    "rejeita campo extra %s no confirm",
    async (field) => {
      const dto = plainToInstance(PasswordResetConfirmDto, {
        token: "a".repeat(43),
        newPassword: "SenhaSegura1",
        [field]: "não permitido",
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map(({ property }) => property)).toContain(field);
    },
  );
});

function createConfirmDto(newPassword: string): PasswordResetConfirmDto {
  return plainToInstance(PasswordResetConfirmDto, {
    token: "a".repeat(43),
    newPassword,
  });
}
