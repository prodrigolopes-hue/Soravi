import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { UsersController } from "./users.controller";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { UsersService } from "./users.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
    ThrottlerModule.forRoot([
      {
        ttl: 3_600_000,
        limit: 3,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersPhoneService,
    UsersPasswordService,
    UsersAdminStatusService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
