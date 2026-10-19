import { ConfigService } from "@nestjs/config";
import { FactoryProvider } from "@nestjs/common";

import { createPersonalIdentityRecordingConfigurationFromEnvironment } from "../../config/environment.validation";
import { PrismaService } from "../../database/prisma.service";
import { PersonalIdentityRecordingService } from "./personal-identity-recording.service";

export const PERSONAL_IDENTITY_RECORDING_SERVICE = Symbol("PERSONAL_IDENTITY_RECORDING_SERVICE");

const personalIdentityConfigurationKeys = [
  "PERSONAL_IDENTITY_RECORDING_ENABLED",
  "CPF_ENCRYPTION_KEY",
  "CPF_ENCRYPTION_KEY_ID",
  "CPF_HMAC_KEY",
  "CPF_HMAC_KEY_ID",
] as const;

export const personalIdentityRecordingProvider: FactoryProvider<PersonalIdentityRecordingService | undefined> = {
  provide: PERSONAL_IDENTITY_RECORDING_SERVICE,
  inject: [PrismaService, ConfigService],
  useFactory: (prisma: PrismaService, configService: ConfigService) => {
    const environment = Object.fromEntries(
      personalIdentityConfigurationKeys.map((key) => [key, configService.get(key)]),
    );
    const configuration = createPersonalIdentityRecordingConfigurationFromEnvironment(environment);
    if (!configuration) return undefined;
    return new PersonalIdentityRecordingService(prisma, configuration.cpfProtector, configuration.hmacKeyId);
  },
};
