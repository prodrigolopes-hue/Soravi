import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../database/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthTokensService } from "./auth-tokens.service";
import { AuthRefreshTokenHistoryCleanupService } from "./auth-refresh-token-history-cleanup.service";
import {
  PASSWORD_RESET_DELIVERY_PORT,
  PasswordResetDeliveryPort,
} from "./password-reset-delivery.port";
import { PasswordResetService } from "./password-reset.service";
import { ResendPasswordResetDeliveryAdapter } from "./resend-password-reset-delivery.adapter";
import { UnavailablePasswordResetDeliveryService } from "./unavailable-password-reset-delivery.service";
import { EmailVerificationService } from "./email-verification.service";
import { EMAIL_VERIFICATION_DELIVERY_PORT, EmailVerificationDeliveryPort } from "./email-verification-delivery.port";
import { UnavailableEmailVerificationDeliveryService } from "./unavailable-email-verification-delivery.service";
import { ResendEmailVerificationDeliveryAdapter } from "./resend-email-verification-delivery.adapter";

export function createPasswordResetDeliveryPort(
  configService: ConfigService,
): PasswordResetDeliveryPort {
  const provider = configService.get<string>(
    "PASSWORD_RESET_DELIVERY_PROVIDER",
    "unavailable",
  );

  if (provider === "resend") {
    return new ResendPasswordResetDeliveryAdapter(configService);
  }

  if (provider === "unavailable") {
    return new UnavailablePasswordResetDeliveryService();
  }

  throw new Error("Provider de entrega de recuperação de senha inválido.");
}

export function createEmailVerificationDeliveryPort(
  configService: ConfigService,
): EmailVerificationDeliveryPort {
  const provider = configService.get<string>(
    "PASSWORD_RESET_DELIVERY_PROVIDER",
    "unavailable",
  );

  if (provider === "resend") {
    return new ResendEmailVerificationDeliveryAdapter(configService);
  }

  if (provider === "unavailable") {
    return new UnavailableEmailVerificationDeliveryService();
  }

  throw new Error("Provider de entrega de confirmacao de e-mail invalido.");
}

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensService,
    PasswordResetService,
    EmailVerificationService,
    AuthRefreshTokenHistoryCleanupService,
    {
      provide: PASSWORD_RESET_DELIVERY_PORT,
      inject: [ConfigService],
      useFactory: createPasswordResetDeliveryPort,
    },
    {
      provide: EMAIL_VERIFICATION_DELIVERY_PORT,
      inject: [ConfigService],
      useFactory: createEmailVerificationDeliveryPort,
    },
  ],
  exports: [
    AuthService,
    AuthTokensService,
  ],
})
export class AuthModule {}
