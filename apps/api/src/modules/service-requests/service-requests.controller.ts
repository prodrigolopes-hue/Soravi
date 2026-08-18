import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestPhotoResponseDto } from "./dto/service-request-photo-response.dto";
import { ServiceRequestResponseDto } from "./dto/service-request-response.dto";
import { ServiceRequestsMineListResponseDto } from "./dto/service-requests-mine-list-response.dto";
import { ServiceRequestsMineQueryDto } from "./dto/service-requests-mine-query.dto";
import { SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES } from "./service-request-photo-type";
import { ServiceRequestsService } from "./service-requests.service";

interface UploadedPhoto {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Controller("service-requests")
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Get("mine")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ServiceRequestsMineQueryDto,
  ): Promise<ServiceRequestsMineListResponseDto> {
    return this.serviceRequestsService.findMine(
      currentUser.id,
      query,
    );
  }

  @Get(":serviceRequestId")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findOneMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
  ): Promise<ServiceRequestResponseDto> {
    return this.serviceRequestsService.findOneMine(
      currentUser.id,
      serviceRequestId,
    );
  }

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

  @Post(":serviceRequestId/photos")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        files: 1,
        fileSize: SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES,
      },
    }),
  )
  uploadPhoto(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @UploadedFile() file: UploadedPhoto | undefined,
  ): Promise<ServiceRequestPhotoResponseDto> {
    return this.serviceRequestsService.uploadPhoto(
      currentUser.id,
      serviceRequestId,
      file,
    );
  }
}
