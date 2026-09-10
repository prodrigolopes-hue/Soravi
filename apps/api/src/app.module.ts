import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { RateLimitModule } from "./common/rate-limit/rate-limit.module";
import { validateEnvironment } from "./config/environment.validation";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { CategoryRequestsModule } from "./modules/category-requests/category-requests.module";
import { UsersModule } from "./modules/users/users.module";
import { LaunchInterestsModule } from "./modules/launch-interests/launch-interests.module";
import { CategorySuggestionsModule } from "./modules/category-suggestions/category-suggestions.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PhoneVerificationModule } from "./modules/phone-verification/phone-verification.module";
import { ServiceRequestsModule } from "./modules/service-requests/service-requests.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment,
    }),
    RateLimitModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    CategoryRequestsModule,
    LaunchInterestsModule,
    CategorySuggestionsModule,
    ConversationsModule,
    NotificationsModule,
    PhoneVerificationModule,
    ServiceRequestsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
