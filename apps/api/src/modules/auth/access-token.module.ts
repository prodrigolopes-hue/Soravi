import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenAuthService } from "./access-token-auth.service";
import { AccessTokenGuard } from "./guards/access-token.guard";
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
    RolesGuard,
  ],
  exports: [
    JwtModule,
    AccessTokenAuthService,
    AccessTokenGuard,
    RolesGuard,
  ],
})
export class AccessTokenModule { }