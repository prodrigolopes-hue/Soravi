import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { AcceptProposalResponseDto } from "./dto/accept-proposal-response.dto";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { ProposalResponseDto } from "./dto/proposal-response.dto";
import { ProposalsReceivedListResponseDto } from "./dto/proposals-received-list-response.dto";
import { ProposalsReceivedQueryDto } from "./dto/proposals-received-query.dto";
import { ProposalsService } from "./proposals.service";
import { IncreaseVisibleProposalLimitDto } from "./dto/increase-visible-proposal-limit.dto";

@Controller("service-requests/:serviceRequestId/proposals")
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findReceived(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Query() query: ProposalsReceivedQueryDto,
  ): Promise<ProposalsReceivedListResponseDto> {
    return this.proposalsService.findReceived(
      currentUser.id,
      serviceRequestId,
      query,
    );
  }

  @Post()
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.proposalsService.create(currentUser.id, serviceRequestId, dto);
  }

  @Post("next")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  requestNext(@CurrentUser() user: AuthenticatedUser, @Param("serviceRequestId", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.proposalsService.requestNext(user.id, id);
  }

  @Patch("visible-limit")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  increaseLimit(@CurrentUser() user: AuthenticatedUser, @Param("serviceRequestId", new ParseUUIDPipe()) id: string, @Body() dto: IncreaseVisibleProposalLimitDto): Promise<void> {
    return this.proposalsService.increaseVisibleLimit(user.id, id, dto.limit);
  }
}

@Controller("proposals")
export class ProposalAcceptanceController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post(":proposalId/accept")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  accept(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("proposalId", new ParseUUIDPipe()) proposalId: string,
  ): Promise<AcceptProposalResponseDto> {
    return this.proposalsService.accept(currentUser.id, proposalId);
  }

  @Post(":proposalId/reject")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  reject(@CurrentUser() user: AuthenticatedUser, @Param("proposalId", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.proposalsService.reject(user.id, id);
  }

  @Post(":proposalId/withdraw")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  withdraw(@CurrentUser() user: AuthenticatedUser, @Param("proposalId", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.proposalsService.withdraw(user.id, id);
  }
}
