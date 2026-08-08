import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { LaunchInterestsController } from "./launch-interests.controller";
import { LaunchInterestsService } from "./launch-interests.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
  ],
  controllers: [
    LaunchInterestsController,
  ],
  providers: [
    LaunchInterestsService,
  ],
})
export class LaunchInterestsModule { }