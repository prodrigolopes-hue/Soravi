import { Inject, Injectable, Logger } from "@nestjs/common";

import { STORAGE_SERVICE, StorageService } from "../../storage/storage.service";

export const PROFESSIONAL_PROFILE_PHOTO_READ_URL_TTL_SECONDS = 15 * 60;

export interface ProfessionalProfilePhotoReadResponse {
  url: string;
  expiresAt: string;
}

@Injectable()
export class ProfessionalProfilePhotoReadService {
  private readonly logger = new Logger(ProfessionalProfilePhotoReadService.name);

  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async createTemporaryReadUrl(
    objectKey: string | undefined,
  ): Promise<ProfessionalProfilePhotoReadResponse | null> {
    if (!objectKey) {
      return null;
    }

    const expiresAt = new Date(
      Date.now() + PROFESSIONAL_PROFILE_PHOTO_READ_URL_TTL_SECONDS * 1000,
    );

    try {
      const url = await this.storage.createTemporaryReadUrl(
        objectKey,
        PROFESSIONAL_PROFILE_PHOTO_READ_URL_TTL_SECONDS,
      );
      return { url, expiresAt: expiresAt.toISOString() };
    } catch {
      this.logger.error(
        "Falha sanitizada ao assinar URL temporária de foto profissional.",
      );
      return null;
    }
  }
}
