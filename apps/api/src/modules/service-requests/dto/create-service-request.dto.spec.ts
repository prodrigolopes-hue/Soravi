import "reflect-metadata";

import { validate } from "class-validator";

import { CreateServiceRequestDto } from "./create-service-request.dto";

describe("CreateServiceRequestDto", () => {
  it.each(["", null, "not-a-uuid"])("rejeita destinatário explicitamente inválido: %p", async (targetProfessionalProfileId) => {
    const dto = Object.assign(new CreateServiceRequestDto(), {
      categoryId: "825afb87-2b81-4de7-9606-8f382fff3341",
      title: "Instalar tomada",
      location: {
        country: "BR", state: "SP", city: "Campinas", neighborhood: "Centro",
        postalCode: "13000-000", addressLine: "Rua A", addressNumber: "1",
      },
      targetProfessionalProfileId,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "targetProfessionalProfileId")).toBe(true);
  });
});
