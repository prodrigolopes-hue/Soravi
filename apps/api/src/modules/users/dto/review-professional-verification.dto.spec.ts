import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ReviewProfessionalVerificationDto } from "./review-professional-verification.dto";

describe("ReviewProfessionalVerificationDto", () => {
  it("aceita APPROVED e trim de reviewNotes", async () => {
    const dto = plainToInstance(ReviewProfessionalVerificationDto, { status: "APPROVED", reviewNotes: "  nota  " });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reviewNotes).toBe("nota");
  });

  it.each(["PENDING", "NOT_STARTED", "INVALID"]) ("rejeita destino %s", async (status) => {
    const dto = plainToInstance(ReviewProfessionalVerificationDto, { status });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("rejeita reviewNotes acima de 1000 caracteres", async () => {
    const dto = plainToInstance(ReviewProfessionalVerificationDto, { status: "REJECTED", reviewNotes: "a".repeat(1001) });
    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
