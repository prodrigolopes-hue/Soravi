import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenGuard } from "./guards/access-token.guard";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.register({}),
  ],
  providers: [AccessTokenGuard],
  exports: [
    JwtModule,
    AccessTokenGuard,
  ],
})
export class AccessTokenModule {}