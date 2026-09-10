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
    AuthRefreshTokenHistoryCleanupService,
    {
      provide: PASSWORD_RESET_DELIVERY_PORT,
      inject: [ConfigService],
      useFactory: createPasswordResetDeliveryPort,
    },
  ],
  exports: [
    AuthService,
    AuthTokensService,
  ],
})
export class AuthModule {}
