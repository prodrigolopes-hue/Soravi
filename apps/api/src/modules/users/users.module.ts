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
  ],
  exports: [UsersService],
})
export class UsersModule {}
