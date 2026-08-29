import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenAuthService } from "./access-token-auth.service";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { PhoneVerifiedGuard } from "./guards/phone-verified.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.register({}),
  ],
  providers: [
    AccessTokenAuthService,
    AccessTokenGuard,
    PhoneVerifiedGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    AccessTokenAuthService,
    AccessTokenGuard,
    PhoneVerifiedGuard,
    RolesGuard,
  ],
})
export class AccessTokenModule { }
