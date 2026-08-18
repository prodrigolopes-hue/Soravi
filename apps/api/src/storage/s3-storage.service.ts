import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

import {
  StorageService,
  StoredObject,
  UploadObjectInput,
} from "./storage.service";
import { S3_CLIENT } from "./storage.tokens";

@Injectable()
export class S3StorageService implements StorageService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT)
    private readonly s3Client: S3Client,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>(
      "STORAGE_S3_BUCKET",
    );
  }

  async upload(input: UploadObjectInput): Promise<StoredObject> {
    const objectKey = `objects/${randomUUID()}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      }),
    );

    return { objectKey };
  }

  async delete(objectKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  createTemporaryReadUrl(
    objectKey: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
      { expiresIn: expiresInSeconds },
    );
  }
}
