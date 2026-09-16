import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

@Module({
  imports: [PrismaModule, AccessTokenModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
