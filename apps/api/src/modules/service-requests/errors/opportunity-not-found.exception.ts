import { NotFoundException } from "@nestjs/common";

export class OpportunityNotFoundException extends NotFoundException {
  constructor() {
    super({
      code: "OPPORTUNITY_NOT_FOUND",
      message: "Oportunidade não encontrada.",
    });
  }
}