import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { Role } from "../../../generated/prisma/client";
import { RegisterUserDto } from "./register-user.dto";

describe("RegisterUserDto phone", () => {
  it.each([
    "(21) 99999-9999",
    "21 99999-9999",
    "21999999999",
    "+55 21 99999-9999",
    "5521999999999",
    "(21) 3333-4444",
  ])("aceita telefone brasileiro %s", async (phone) => {
    await expect(validate(createDto(phone))).resolves.toHaveLength(0);
  });

  it.each([
    "99999-9999",
    "219999999",
    "55219999999999",
    "+54 21 99999-9999",
    "telefone 21999999999",
    "   ",
    "()+-",
    "00 99999-9999",
  ])("rejeita telefone inválido %s", async (phone) => {
    const errors = await validate(createDto(phone));

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toEqual(
      expect.objectContaining({
        isBrazilianPhone: "Informe um telefone brasileiro válido com DDD.",
      }),
    );
  });

  it.each([undefined, null])("mantém telefone %s como opcional", async (phone) => {
    await expect(validate(createDto(phone))).resolves.toHaveLength(0);
  });
});

describe("RegisterUserDto password", () => {
  it.each([
    "SenhaSegura123",
    "somenteletrasminusculas",
    "123456789012",
    "!@#$%^&*()_+",
    `${"a".repeat(127)}1`,
  ])(
    "aceita senha de 12–128 caracteres independentemente da composição: %s",
    async (password) => {
      const dto = createDto(undefined);
      dto.password = password;

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it.each(["Curta1", `${"a".repeat(128)}1`])(
    "rejeita senha fora do comprimento permitido: %s",
    async (password) => {
      const dto = createDto(undefined);
      dto.password = password;

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});

describe("RegisterUserDto professional details", () => {
  it("exige e normaliza os dados profissionais para PROFESSIONAL", async () => {
    const dto = plainToInstance(RegisterUserDto, {
      ...professionalBody(),
      professionalTitle: "  Eletricista residencial  ",
      serviceArea: "  Campinas e região  ",
      description: "  Profissional com experiência em instalações elétricas residenciais.  ",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.professionalTitle).toBe("Eletricista residencial");
    expect(dto.serviceArea).toBe("Campinas e região");
    expect(dto.description).toBe("Profissional com experiência em instalações elétricas residenciais.");
  });

  it.each([
    { professionalTitle: undefined },
    { serviceArea: undefined },
    { description: undefined },
    { professionalTitle: "ab" },
    { professionalTitle: "a".repeat(81) },
    { serviceArea: "a" },
    { serviceArea: "a".repeat(101) },
    { description: "a".repeat(29) },
    { description: "a".repeat(501) },
  ])("rejeita detalhes profissionais ausentes ou fora dos limites %#", async (overrides) => {
    const dto = plainToInstance(RegisterUserDto, {
      ...professionalBody(),
      ...overrides,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("mantém CUSTOMER válido sem detalhes profissionais", async () => {
    await expect(validate(createDto(undefined))).resolves.toHaveLength(0);
  });
});

function createDto(phone: string | null | undefined): RegisterUserDto {
  return plainToInstance(RegisterUserDto, {
    name: "Maria da Silva",
    email: "maria@example.com",
    phone,
    password: "SenhaSegura123",
    initialRole: Role.CUSTOMER,
    acceptedTermsVersion: "1.0",
    acceptedPrivacyPolicyVersion: "1.0",
  });
}

function professionalBody() {
  return {
    ...createDto(undefined),
    initialRole: Role.PROFESSIONAL,
    categorySlugs: ["eletrica"],
    professionalTitle: "Eletricista residencial",
    serviceArea: "Campinas e região",
    description: "Profissional com experiência em instalações elétricas residenciais.",
  };
}
