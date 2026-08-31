import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../../database/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthTokensService } from "./auth-tokens.service";
import {
  PASSWORD_RESET_DELIVERY_PORT,
} from "./password-reset-delivery.port";
import { PasswordResetService } from "./password-reset.service";
import { UnavailablePasswordResetDeliveryService } from "./unavailable-password-reset-delivery.service";

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 900_000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensService,
    PasswordResetService,
    {
      provide: PASSWORD_RESET_DELIVERY_PORT,
      useClass: UnavailablePasswordResetDeliveryService,
    },
  ],
  exports: [
    AuthService,
    AuthTokensService,
  ],
})
export class AuthModule {}
