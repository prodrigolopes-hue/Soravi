import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { s3ClientProvider } from "./s3-client.provider";
import { S3StorageService } from "./s3-storage.service";
import { STORAGE_SERVICE } from "./storage.service";

@Module({
  imports: [ConfigModule],
  providers: [
    s3ClientProvider,
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: S3StorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
