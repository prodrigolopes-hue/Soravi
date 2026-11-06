import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({ imports: [PrismaModule, AccessTokenModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
