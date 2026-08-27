import { MODULE_METADATA } from "@nestjs/common/constants";

import { PHONE_VERIFICATION_DELIVERY_PORT } from "./phone-verification-delivery.port";
import { PhoneVerificationModule } from "./phone-verification.module";
import { UnavailablePhoneVerificationDeliveryService } from "./unavailable-phone-verification-delivery.service";

describe("PhoneVerificationModule", () => {
  it("injeta o token pelo binding fail-closed explícito", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PhoneVerificationModule,
    ) as unknown[];

    expect(providers).toContainEqual({
      provide: PHONE_VERIFICATION_DELIVERY_PORT,
      useExisting: UnavailablePhoneVerificationDeliveryService,
    });
  });
});
