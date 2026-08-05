import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { CategoryRequestsController } from "./category-requests.controller";
import { CategoryRequestsService } from "./category-requests.service";

@Module({
  imports: [PrismaModule, AccessTokenModule],
  controllers: [CategoryRequestsController],
  providers: [CategoryRequestsService],
})
export class CategoryRequestsModule {}
