import { Injectable } from "@nestjs/common";

import {
  PhoneVerificationDeliveryError,
  PhoneVerificationDeliveryPort,
  SendPhoneVerificationOtpInput,
} from "./phone-verification-delivery.port";

@Injectable()
export class UnavailablePhoneVerificationDeliveryService
  implements PhoneVerificationDeliveryPort
{
  sendOtp(_input: SendPhoneVerificationOtpInput): Promise<void> {
    return Promise.reject(
      new PhoneVerificationDeliveryError(
        "PERMANENT",
        "DELIVERY_NOT_CONFIGURED",
      ),
    );
  }
}
