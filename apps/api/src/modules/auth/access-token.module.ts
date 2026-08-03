import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { RolesGuard } from "./guards/roles.guard";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.register({}),
  ],
  providers: [
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    AccessTokenGuard,
    RolesGuard,
  ],
})
export class AccessTokenModule { }