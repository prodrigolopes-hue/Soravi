import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../database/prisma.service";
import { PersonalIdentityRecordingService } from "./personal-identity-recording.service";
import { personalIdentityRecordingProvider } from "./personal-identity-recording.provider";

describe("personalIdentityRecordingProvider", () => {
  const keys = {
    CPF_ENCRYPTION_KEY: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
    CPF_ENCRYPTION_KEY_ID: "cpf-encryption-v1",
    CPF_HMAC_KEY: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=",
    CPF_HMAC_KEY_ID: "cpf-hmac-v1",
  };

  it("does not create the service while disabled", () => {
    expect(create({ PERSONAL_IDENTITY_RECORDING_ENABLED: "false" })).toBeUndefined();
  });

  it("creates the service with explicitly configured protection material", () => {
    expect(create({ PERSONAL_IDENTITY_RECORDING_ENABLED: "true", ...keys })).toBeInstanceOf(PersonalIdentityRecordingService);
  });
});

function create(environment: Record<string, string | undefined>): PersonalIdentityRecordingService | undefined {
  const factory = personalIdentityRecordingProvider.useFactory;
  if (!factory) throw new Error("Personal identity provider factory is required.");
  return factory({} as PrismaService, { get: (key: string) => environment[key] } as ConfigService) as PersonalIdentityRecordingService | undefined;
}
