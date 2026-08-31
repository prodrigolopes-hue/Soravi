import { Injectable } from "@nestjs/common";

import {
  PasswordResetDeliveryError,
  PasswordResetDeliveryPort,
  SendPasswordResetInput,
} from "./password-reset-delivery.port";

@Injectable()
export class UnavailablePasswordResetDeliveryService
  implements PasswordResetDeliveryPort
{
  sendReset(_input: SendPasswordResetInput): Promise<void> {
    return Promise.reject(
      new PasswordResetDeliveryError("DELIVERY_NOT_CONFIGURED"),
    );
  }
}
