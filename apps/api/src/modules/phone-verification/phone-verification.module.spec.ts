import { MODULE_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";

import { MetaWhatsAppPhoneVerificationDeliveryAdapter } from "./meta-whatsapp-phone-verification-delivery.adapter";
import { PHONE_VERIFICATION_DELIVERY_PORT } from "./phone-verification-delivery.port";
import {
  createPhoneVerificationDeliveryPort,
  PhoneVerificationModule,
} from "./phone-verification.module";
import { UnavailablePhoneVerificationDeliveryService } from "./unavailable-phone-verification-delivery.service";

describe("PhoneVerificationModule", () => {
  it("registra o token com factory condicional sem adapters eager", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PhoneVerificationModule,
    ) as unknown[];

    expect(providers).toContainEqual({
      provide: PHONE_VERIFICATION_DELIVERY_PORT,
      inject: [ConfigService],
      useFactory: createPhoneVerificationDeliveryPort,
    });
    expect(providers).not.toContain(MetaWhatsAppPhoneVerificationDeliveryAdapter);
    expect(providers).not.toContain(UnavailablePhoneVerificationDeliveryService);
  });

  it("seleciona unavailable sem construir o adapter Meta", () => {
    const configService = {
      get: jest.fn().mockReturnValue("unavailable"),
      getOrThrow: jest.fn(() => {
        throw new Error("Meta não deveria ser construído");
      }),
    } as unknown as ConfigService;

    const port = createPhoneVerificationDeliveryPort(configService);

    expect(port).toBeInstanceOf(UnavailablePhoneVerificationDeliveryService);
  });

  it("seleciona Meta sem usar unavailable", () => {
    const values: Record<string, string> = {
      META_WHATSAPP_ACCESS_TOKEN: "token",
      META_WHATSAPP_PHONE_NUMBER_ID: "phone-id",
      META_WHATSAPP_GRAPH_API_VERSION: "v26.0",
      META_WHATSAPP_OTP_TEMPLATE_NAME: "template",
      META_WHATSAPP_OTP_TEMPLATE_LANGUAGE: "pt_BR",
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) =>
        key === "PHONE_VERIFICATION_DELIVERY_PROVIDER"
          ? "meta"
          : (fallback ?? 5_000),
      ),
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    const port = createPhoneVerificationDeliveryPort(configService);

    expect(port).toBeInstanceOf(MetaWhatsAppPhoneVerificationDeliveryAdapter);
    expect(port).not.toBeInstanceOf(UnavailablePhoneVerificationDeliveryService);
  });

  it("rejeita provider desconhecido sem fallback silencioso", () => {
    const configService = {
      get: jest.fn().mockReturnValue("unknown"),
    } as unknown as ConfigService;

    expect(() => createPhoneVerificationDeliveryPort(configService)).toThrow(
      "Provider de entrega de OTP inválido.",
    );
  });
});
