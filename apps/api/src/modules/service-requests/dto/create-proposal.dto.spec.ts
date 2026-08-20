import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { EstimatedDurationUnit } from "../../../generated/prisma/client";
import { CreateProposalDto } from "./create-proposal.dto";

describe("CreateProposalDto", () => {
  it("rejeita amountInCents inválido", async () => {
    const errors = await validateDto({ amountInCents: 0 });

    expect(errors).toContain("amountInCents");
  });

  it("rejeita prazo inválido", async () => {
    const errors = await validateDto({ estimatedDurationValue: 0 });

    expect(errors).toContain("estimatedDurationValue");
  });

  it("rejeita unidade de prazo fora do enum", async () => {
    const errors = await validateDto({ estimatedDurationUnit: "MINUTE" });

    expect(errors).toContain("estimatedDurationUnit");
  });

  it("rejeita mensagem com mais de 2000 caracteres", async () => {
    const errors = await validateDto({ message: "a".repeat(2001) });

    expect(errors).toContain("message");
  });

  it("remove espaços da mensagem e aceita o payload válido", async () => {
    const dto = createDto({ message: "  Posso realizar amanhã.  " });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.message).toBe("Posso realizar amanhã.");
  });

  it.each(["status", "professionalProfileId", "serviceRequestId"])(
    "rejeita o campo não permitido %s com whitelist estrita",
    async (field) => {
      const errors = await validate(createDto({ [field]: "não permitido" }), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map((error) => error.property)).toContain(field);
    },
  );
});

function createDto(overrides: Record<string, unknown> = {}): CreateProposalDto {
  return plainToInstance(CreateProposalDto, {
    amountInCents: 15000,
    estimatedDurationValue: 2,
    estimatedDurationUnit: EstimatedDurationUnit.HOUR,
    message: "Posso realizar amanhã.",
    ...overrides,
  });
}

async function validateDto(
  overrides: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(createDto(overrides));
  return errors.map((error) => error.property);
}