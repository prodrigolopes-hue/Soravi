import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnvironment } from "./config/environment.validation";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnvironment,
    }),
    PrismaModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}