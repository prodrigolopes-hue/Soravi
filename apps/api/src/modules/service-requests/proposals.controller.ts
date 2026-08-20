import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { ProposalResponseDto } from "./dto/proposal-response.dto";
import { ProposalsService } from "./proposals.service";

@Controller("service-requests/:serviceRequestId/proposals")
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.proposalsService.create(currentUser.id, serviceRequestId, dto);
  }
}