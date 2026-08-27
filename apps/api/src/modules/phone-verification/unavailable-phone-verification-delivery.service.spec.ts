import { PhoneVerificationDeliveryError } from "./phone-verification-delivery.port";
import { UnavailablePhoneVerificationDeliveryService } from "./unavailable-phone-verification-delivery.service";

describe("UnavailablePhoneVerificationDeliveryService", () => {
  it("falha de forma explícita sem executar I/O externo", async () => {
    const service = new UnavailablePhoneVerificationDeliveryService();

    await expect(
      service.sendOtp({
        challengeId: "challenge-id",
        phoneNormalized: "+5521999999999",
        code: "012345",
        expiresAt: new Date(),
      }),
    ).rejects.toMatchObject<Partial<PhoneVerificationDeliveryError>>({
      kind: "PERMANENT",
      code: "DELIVERY_NOT_CONFIGURED",
      message: "Phone verification OTP delivery failed.",
    });
  });
});
