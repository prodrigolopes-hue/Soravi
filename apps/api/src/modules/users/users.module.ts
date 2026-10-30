import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { StorageModule } from "../../storage/storage.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { UsersController } from "./users.controller";
import { CurrentProfessionalProfileService } from "./current-professional-profile.service";
import { CustomerProfileActivationService } from "./customer-profile-activation.service";
import { ProfessionalProfileActivationService } from "./professional-profile-activation.service";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { UsersService } from "./users.service";
import { personalIdentityRecordingProvider } from "./personal-identity-recording.provider";
import { PersonalIdentityStatusService } from "./personal-identity-status.service";
import { ProfessionalProfilePhotoService } from "./professional-profile-photo.service";
import { ProfessionalProfilePhotoProcessor } from "./professional-profile-photo.processor";
import { ProfessionalProfilePhotoReadService } from "./professional-profile-photo-read.service";
import { ProfessionalIdentityDocumentService } from "./professional-identity-document.service";
import { ProfessionalIdentityReviewService } from "./professional-identity-review.service";
import { ProfessionalIdentityVerificationStatusService } from "./professional-identity-verification-status.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
    StorageModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    CustomerProfileActivationService,
    ProfessionalProfileActivationService,
    CurrentProfessionalProfileService,
    UsersPhoneService,
    UsersPasswordService,
    UsersAdminStatusService,
    ProfessionalVerificationSubmissionService,
    ProfessionalVerificationReviewService,
    personalIdentityRecordingProvider,
    PersonalIdentityStatusService,
    ProfessionalProfilePhotoService,
    ProfessionalProfilePhotoProcessor,
    ProfessionalProfilePhotoReadService,
    ProfessionalIdentityDocumentService,
    ProfessionalIdentityReviewService,
    ProfessionalIdentityVerificationStatusService,
  ],
  exports: [UsersService, ProfessionalProfilePhotoReadService],
})
export class UsersModule {}
