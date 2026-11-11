import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { UsersModule } from "../users/users.module";
import { ProfessionalDiscoveryController } from "./professional-discovery.controller";
import { ProfessionalDiscoveryService } from "./professional-discovery.service";

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ProfessionalDiscoveryController],
  providers: [ProfessionalDiscoveryService],
})
export class ProfessionalDiscoveryModule {}
