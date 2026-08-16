import { Body, Controller, Post, UseGuards } from "@nestjs/common";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestResponseDto } from "./dto/service-request-response.dto";
import { ServiceRequestsService } from "./service-requests.service";

@Controller("service-requests")
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: CreateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    return this.serviceRequestsService.createServiceRequest(
      currentUser.id,
      input,
    );
  }
}