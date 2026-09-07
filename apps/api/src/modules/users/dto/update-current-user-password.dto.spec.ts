import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { UpdateCurrentUserPasswordDto } from "./update-current-user-password.dto";

describe("UpdateCurrentUserPasswordDto", () => {
  it("preserva exatamente espaços nas senhas", async () => {
    const dto = plainToInstance(UpdateCurrentUserPasswordDto, {
      currentPassword: " senha atual com espaços ",
      newPassword: " nova senha com espaços ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.currentPassword).toBe(" senha atual com espaços ");
    expect(dto.newPassword).toBe(" nova senha com espaços ");
  });

  it.each([
    "123456789012",
    "aaaaaaaaaaaa",
    "!!!!!!!!!!!!",
    "            ",
    "abc def ghi j",
  ])("aceita qualquer composição válida %#", async (newPassword) => {
    const dto = plainToInstance(UpdateCurrentUserPasswordDto, {
      currentPassword: "senha atual",
      newPassword,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejeita nova senha com menos de 12 caracteres", async () => {
    const errors = await validate(
      plainToInstance(UpdateCurrentUserPasswordDto, {
        currentPassword: "senha atual",
        newPassword: "12345678901",
      }),
    );

    expect(errors.map(({ property }) => property)).toContain("newPassword");
  });

  it("rejeita nova senha com mais de 128 caracteres", async () => {
    const errors = await validate(
      plainToInstance(UpdateCurrentUserPasswordDto, {
        currentPassword: "senha atual",
        newPassword: "a".repeat(129),
      }),
    );

    expect(errors.map(({ property }) => property)).toContain("newPassword");
  });

  it("rejeita campos extras com whitelist e forbidNonWhitelisted", async () => {
    const dto = plainToInstance(UpdateCurrentUserPasswordDto, {
      currentPassword: "senha atual",
      newPassword: "nova senha ok",
      userId: "outro-usuario",
      sessionId: "outra-sessao",
      role: "ADMIN",
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(["userId", "sessionId", "role"]),
    );
  });
});