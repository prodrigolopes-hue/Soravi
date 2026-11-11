import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { Role, ServiceRequestStatus } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { PhoneVerifiedGuard } from "../auth/guards/phone-verified.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CancelServiceRequestDto } from "./dto/cancel-service-request.dto";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestPhotoResponseDto } from "./dto/service-request-photo-response.dto";
import { ServiceRequestResponseDto } from "./dto/service-request-response.dto";
import { ServiceRequestsMineListResponseDto } from "./dto/service-requests-mine-list-response.dto";
import { ServiceRequestsMineQueryDto } from "./dto/service-requests-mine-query.dto";
import { AdminServiceRequestDetailResponseDto } from "./dto/admin-service-request-detail-response.dto";
import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";
import { SERVICE_REQUEST_PHOTO_MAX_SIZE_BYTES } from "./service-request-photo-type";
import { ServiceRequestsService } from "./service-requests.service";

const ADMIN_SERVICE_REQUEST_STATUSES = [
  ServiceRequestStatus.DRAFT,
  ServiceRequestStatus.OPEN,
  ServiceRequestStatus.RECEIVING_PROPOSALS,
  ServiceRequestStatus.IN_NEGOTIATION,
  ServiceRequestStatus.HIRED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.COMPLETED,
  ServiceRequestStatus.CANCELLED,
] as const;

function isAdminServiceRequestStatus(
  value: string,
): value is ServiceRequestStatus {
  return ADMIN_SERVICE_REQUEST_STATUSES.some((status) => status === value);
}

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
    return this.serviceRequestsService.findMine(currentUser.id, query);
  }

  @Get("admin")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findAdmin(
    @Query("code") code?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<unknown> {
    const parsedPage = page === undefined ? 1 : Number(page);
    const parsedLimit = limit === undefined ? 20 : Number(limit);
    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 || !Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) throw new BadRequestException({ code: "SERVICE_REQUEST_ADMIN_PAGINATION_INVALID", message: "Paginação inválida." });
    if (status !== undefined && !isAdminServiceRequestStatus(status)) throw new BadRequestException({ code: "SERVICE_REQUEST_ADMIN_STATUS_INVALID", message: "Status inválido." });
    return this.serviceRequestsService.findAdmin(code, status, parsedPage, parsedLimit);
  }

  @Get("admin/by-code/:publicCode")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findAdminDetailByPublicCode(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("publicCode") publicCode: string,
  ): Promise<AdminServiceRequestDetailResponseDto> {
    return this.serviceRequestsService.findAdminDetailByPublicCode(
      currentUser.id,
      publicCode,
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

  @Patch(":serviceRequestId")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  updateMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() input: UpdateServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    return this.serviceRequestsService.updateMine(
      currentUser.id,
      serviceRequestId,
      input,
    );
  }

  @Post(":serviceRequestId/cancel")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
  cancelMine(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("serviceRequestId", new ParseUUIDPipe()) serviceRequestId: string,
    @Body() input: CancelServiceRequestDto,
  ): Promise<ServiceRequestResponseDto> {
    return this.serviceRequestsService.cancelMine(
      currentUser.id,
      serviceRequestId,
      input,
    );
  }

  @Post()
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
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
  @UseGuards(AccessTokenGuard, RolesGuard, PhoneVerifiedGuard)
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
