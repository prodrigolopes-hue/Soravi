import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { ThrottlerModule } from "@nestjs/throttler";

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{ ttl: 900_000, limit: 10 }],
        storage: new ThrottlerStorageRedisService(
          configService.getOrThrow<string>("REDIS_URL"),
          {
            connectTimeout: 5_000,
            commandTimeout: 2_000,
            enableOfflineQueue: false,
            enableReadyCheck: false,
            maxRetriesPerRequest: 1,
            retryStrategy: (attempt) =>
              attempt <= 3 ? Math.min(attempt * 200, 1_000) : null,
          },
        ),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
