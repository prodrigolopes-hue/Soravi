import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";

import { S3_CLIENT } from "./storage.tokens";

export const s3ClientProvider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): S3Client =>
    new S3Client({
      endpoint: configService.getOrThrow<string>(
        "STORAGE_S3_ENDPOINT",
      ),
      region: configService.get<string>(
        "STORAGE_S3_REGION",
        "auto",
      ),
      credentials: {
        accessKeyId: configService.getOrThrow<string>(
          "STORAGE_S3_ACCESS_KEY_ID",
        ),
        secretAccessKey: configService.getOrThrow<string>(
          "STORAGE_S3_SECRET_ACCESS_KEY",
        ),
      },
    }),
};
