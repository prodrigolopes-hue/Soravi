import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  PayloadTooLargeException,
  Patch,
  Param,
  Post,
  ParseUUIDPipe,
  Query,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { Role } from "../../generated/prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AccessTokenGuard } from "../auth/guards/access-token.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { UsersAdminCustomersListResponseDto } from "./dto/users-admin-customers-list-response.dto";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalsListResponseDto } from "./dto/users-admin-professionals-list-response.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UpdateCurrentUserPasswordDto } from "./dto/update-current-user-password.dto";
import { UpdateCurrentUserPhoneDto } from "./dto/update-current-user-phone.dto";
import { UpdateUserAdminStatusDto } from "./dto/update-user-admin-status.dto";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { ProfessionalVerificationSubmissionResponseDto } from "./dto/professional-verification-submission-response.dto";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { ProfessionalVerificationReviewResponseDto } from "./dto/professional-verification-review-response.dto";
import { ReviewProfessionalVerificationDto } from "./dto/review-professional-verification.dto";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { UsersService } from "./users.service";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";
import { ProfessionalProfileResponseDto } from "./dto/professional-profile-response.dto";
import { UpdateCurrentProfessionalProfileDto } from "./dto/update-current-professional-profile.dto";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { ActivateCurrentProfessionalProfileDto } from "./dto/activate-current-professional-profile.dto";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { RecordPersonalIdentityDto } from "./dto/record-personal-identity.dto";
import { PersonalIdentityRecordingDisabledException } from "./errors/personal-identity-recording-disabled.exception";
import { PERSONAL_IDENTITY_RECORDING_SERVICE } from "./personal-identity-recording.provider";
import { PersonalIdentityRecordingService } from "./personal-identity-recording.service";
import { PersonalIdentityStatusResult, PersonalIdentityStatusService } from "./personal-identity-status.service";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";
import {
  PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES,
  ProfessionalProfilePhotoProcessingError,
} from "./professional-profile-photo-image";

interface UploadedProfessionalProfilePhoto {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersPhoneService: UsersPhoneService,
    private readonly usersPasswordService: UsersPasswordService,
    private readonly usersAdminStatusService: UsersAdminStatusService,
    private readonly professionalVerificationSubmissionService: ProfessionalVerificationSubmissionService,
    private readonly professionalVerificationReviewService: ProfessionalVerificationReviewService,
    private readonly currentProfessionalProfileService: CurrentProfessionalProfileService,
    private readonly customerProfileActivationService: CustomerProfileActivationService,
    private readonly professionalProfileActivationService: ProfessionalProfileActivationService,
    private readonly personalIdentityStatusService: PersonalIdentityStatusService,
    private readonly professionalProfilePhotoService: ProfessionalProfilePhotoService,
    @Inject(PERSONAL_IDENTITY_RECORDING_SERVICE)
    private readonly personalIdentityRecordingService: PersonalIdentityRecordingService | undefined,
  ) {}

  @Get("me")
  @UseGuards(AccessTokenGuard)
  findCurrentUser(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.usersService.findSafeById(
      currentUser.id,
    );
  }

  @Get("me/personal-identity")
  @Header("Cache-Control", "no-store")
  @UseGuards(AccessTokenGuard)
  findCurrentPersonalIdentity(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PersonalIdentityStatusResult> {
    return this.personalIdentityStatusService.findCurrent(currentUser.id);
  }

  @Post("me/personal-identity")
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  recordCurrentPersonalIdentity(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: RecordPersonalIdentityDto,
  ): Promise<{ recorded: true }> {
    if (!this.personalIdentityRecordingService) {
      throw new PersonalIdentityRecordingDisabledException();
    }
    return this.personalIdentityRecordingService.recordInitial(
      currentUser.id,
      input.cpf,
    );
  }

  @Post("me/roles/customer")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  activateCurrentCustomerProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.customerProfileActivationService.activateCurrentProfessional(
      currentUser.id,
    );
  }

  @Post("me/roles/professional")
  @Roles(Role.CUSTOMER)
  @UseGuards(AccessTokenGuard, RolesGuard)
  activateCurrentProfessionalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: ActivateCurrentProfessionalProfileDto,
  ): Promise<UserResponseDto> {
    return this.professionalProfileActivationService.activateCurrentCustomer(currentUser.id, input);
  }

  @Patch("me/phone")
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  updateCurrentUserPhone(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: UpdateCurrentUserPhoneDto,
  ): Promise<UserResponseDto> {
    return this.usersPhoneService.updateCurrentUserPhone(
      currentUser.id,
      currentUser.sessionId,
      input,
    );
  }

  @Patch("me/password")
  @UseGuards(AccessTokenGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  updateCurrentUserPassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: UpdateCurrentUserPasswordDto,
  ): Promise<void> {
    return this.usersPasswordService.updateCurrentUserPassword(
      currentUser.id,
      currentUser.sessionId,
      input,
    );
  }

  @Get("me/professional-access")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  validateProfessionalAccess(): {
    data: {
      authorized: true;
      role: Role;
    };
  } {
    return {
      data: {
        authorized: true,
        role: Role.PROFESSIONAL,
      },
    };
  }

  @Get("admin/customers")
  @Roles(Role.ADMIN)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  findAdminCustomers(
    @Query() query: UsersAdminCustomersQueryDto,
  ): Promise<UsersAdminCustomersListResponseDto> {
    return this.usersService.findAllAdminCustomers(query);
  }

  @Get("admin/professionals")
  @Roles(Role.ADMIN)
  @UseGuards(
    AccessTokenGuard,
    RolesGuard,
  )
  findAdminProfessionals(
    @Query() query: UsersAdminProfessionalsQueryDto,
  ): Promise<UsersAdminProfessionalsListResponseDto> {
    return this.usersService.findAllAdminProfessionals(query);
  }

  @Post("me/professional-verification/submission")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  submitProfessionalVerification(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProfessionalVerificationSubmissionResponseDto> {
    return this.professionalVerificationSubmissionService.submit(currentUser.id);
  }

  @Get("me/professional-profile")
  @Header("Cache-Control", "no-store")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  findCurrentProfessionalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProfessionalProfileResponseDto> {
    return this.currentProfessionalProfileService.findCurrent(currentUser.id);
  }

  @Patch("me/professional-profile")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard)
  updateCurrentProfessionalProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() input: UpdateCurrentProfessionalProfileDto,
  ): Promise<ProfessionalProfileResponseDto> {
    return this.currentProfessionalProfileService.updateCurrent(
      currentUser.id,
      input,
    );
  }

  @Put("me/professional-profile/photo")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fields: 0,
        fileSize: PROFESSIONAL_PROFILE_PHOTO_MAX_SIZE_BYTES,
      },
    }),
  )
  async replaceCurrentProfessionalProfilePhoto(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: UploadedProfessionalProfilePhoto | undefined,
  ): Promise<{ recorded: true }> {
    if (!file) {
      throw new BadRequestException({
        code: "PROFESSIONAL_PROFILE_PHOTO_REQUIRED",
        message: "Envie uma foto no campo photo.",
      });
    }

    try {
      await this.professionalProfilePhotoService.replaceCurrent(currentUser.id, {
        buffer: file.buffer,
        declaredMimeType: file.mimetype,
      });
    } catch (error: unknown) {
      this.rethrowProfessionalProfilePhotoProcessingError(error);
    }

    return { recorded: true };
  }

  @Delete("me/professional-profile/photo")
  @Roles(Role.PROFESSIONAL)
  @UseGuards(AccessTokenGuard, RolesGuard, ThrottlerGuard)
  @Throttle({
    default: {
      limit: 3,
      ttl: 3_600_000,
    },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCurrentProfessionalProfilePhoto(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<void> {
    await this.professionalProfilePhotoService.removeCurrent(currentUser.id);
  }

  private rethrowProfessionalProfilePhotoProcessingError(error: unknown): never {
    if (!(error instanceof ProfessionalProfilePhotoProcessingError)) {
      throw error;
    }

    if (error.code === "PHOTO_TOO_LARGE") {
      throw new PayloadTooLargeException({
        code: "PROFESSIONAL_PROFILE_PHOTO_TOO_LARGE",
        message: "A foto excede o tamanho permitido.",
      });
    }

    const responseByCode = {
      INVALID_PHOTO: {
        code: "PROFESSIONAL_PROFILE_PHOTO_INVALID",
        message: "Não foi possível processar a foto enviada.",
      },
      UNSUPPORTED_PHOTO_FORMAT: {
        code: "PROFESSIONAL_PROFILE_PHOTO_UNSUPPORTED_FORMAT",
        message: "Envie uma imagem JPEG, PNG ou WebP válida.",
      },
      ANIMATED_PHOTO: {
        code: "PROFESSIONAL_PROFILE_PHOTO_ANIMATED",
        message: "A foto não pode ser animada.",
      },
      PHOTO_DIMENSIONS_OUT_OF_RANGE: {
        code: "PROFESSIONAL_PROFILE_PHOTO_DIMENSIONS_OUT_OF_RANGE",
        message: "A foto deve ter dimensões entre os limites permitidos.",
      },
      PHOTO_TOO_LARGE: {
        code: "PROFESSIONAL_PROFILE_PHOTO_TOO_LARGE",
        message: "A foto excede o tamanho permitido.",
      },
    } as const;

    throw new BadRequestException(responseByCode[error.code]);
  }

  @Patch("admin/professionals/:userId/verification")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  reviewProfessionalVerification(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() input: ReviewProfessionalVerificationDto,
  ): Promise<ProfessionalVerificationReviewResponseDto> {
    return this.professionalVerificationReviewService.review(currentUser.id, userId, input);
  }

  @Patch("admin/:userId/status")
  @Roles(Role.ADMIN)
  @UseGuards(AccessTokenGuard, RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateAdminUserStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() input: UpdateUserAdminStatusDto,
  ): Promise<void> {
    return this.usersAdminStatusService.updateStatus(
      currentUser.id,
      userId,
      input,
    );
  }
}
