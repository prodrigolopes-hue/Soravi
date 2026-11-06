import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateContractReportDto } from "./dto/create-contract-report.dto";
import { UpdateContractReportDto } from "./dto/update-contract-report.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("contracts/:contractId")
  @UseGuards(AccessTokenGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Param("contractId", new ParseUUIDPipe()) contractId: string, @Body() input: CreateContractReportDto) { return this.reports.createForContract(user.id, contractId, input); }

  @Get("admin") @Roles(Role.ADMIN) @UseGuards(AccessTokenGuard, RolesGuard)
  list() { return this.reports.listForAdmin(); }

  @Get("admin/:id") @Roles(Role.ADMIN) @UseGuards(AccessTokenGuard, RolesGuard)
  detail(@Param("id", new ParseUUIDPipe()) id: string) { return this.reports.detailForAdmin(id); }

  @Patch("admin/:id") @Roles(Role.ADMIN) @UseGuards(AccessTokenGuard, RolesGuard)
  update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string, @Body() input: UpdateContractReportDto) { return this.reports.updateForAdmin(user.id, id, input); }
}
