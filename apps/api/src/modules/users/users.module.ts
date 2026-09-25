import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { AccessTokenModule } from "../auth/access-token.module";
import { UsersController } from "./users.controller";
import { UsersAdminStatusService } from "./users-admin-status.service";
import { UsersPasswordService } from "./users-password.service";
import { UsersPhoneService } from "./users-phone.service";
import { ProfessionalVerificationSubmissionService } from "./professional-verification-submission.service";
import { ProfessionalVerificationReviewService } from "./professional-verification-review.service";
import { UsersService } from "./users.service";

@Module({
  imports: [
    PrismaModule,
    AccessTokenModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersPhoneService,
    UsersPasswordService,
    UsersAdminStatusService,
    ProfessionalVerificationSubmissionService,
    ProfessionalVerificationReviewService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
