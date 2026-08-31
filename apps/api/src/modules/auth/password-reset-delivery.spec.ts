import {
  PasswordResetDeliveryError,
} from "./password-reset-delivery.port";
import { UnavailablePasswordResetDeliveryService } from "./unavailable-password-reset-delivery.service";

describe("UnavailablePasswordResetDeliveryService", () => {
  it("falha de forma tipada sem expor email ou token", async () => {
    const service = new UnavailablePasswordResetDeliveryService();
    const error = await service.sendReset({
      email: "maria@example.com",
      rawToken: "token-secreto",
      expiresAt: new Date(),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordResetDeliveryError);
    expect(JSON.stringify(error)).not.toContain("maria@example.com");
    expect(JSON.stringify(error)).not.toContain("token-secreto");
  });
});
