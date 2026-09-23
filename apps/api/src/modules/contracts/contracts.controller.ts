import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { ContractResponseDto } from "./dto/contract-response.dto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post(":contractId/start")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  start(@CurrentUser() currentUser: AuthenticatedUser, @Param("contractId", new ParseUUIDPipe()) contractId: string): Promise<ContractResponseDto> {
    return this.contractsService.start(currentUser.id, contractId);
  }

  @Post(":contractId/complete")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  complete(@CurrentUser() currentUser: AuthenticatedUser, @Param("contractId", new ParseUUIDPipe()) contractId: string): Promise<ContractResponseDto> {
    return this.contractsService.complete(currentUser.id, contractId);
  }

  @Post(":contractId/review") @Roles(Role.CUSTOMER) @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  review(@CurrentUser() currentUser: AuthenticatedUser, @Param("contractId", new ParseUUIDPipe()) contractId: string, @Body() input: CreateReviewDto) {
    return this.contractsService.review(currentUser.id, contractId, input);
  }

  @Post(":contractId/customer-review") @Roles(Role.PROFESSIONAL) @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  reviewCustomer(@CurrentUser() currentUser: AuthenticatedUser, @Param("contractId", new ParseUUIDPipe()) contractId: string, @Body() input: CreateReviewDto) {
    return this.contractsService.reviewCustomer(currentUser.id, contractId, input);
  }
}
