import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import {
  CommunicationChannel,
  CommunicationPreference,
} from "../../generated/prisma/client";

export interface UpsertCommunicationPreferenceInput {
  userId: string;
  channel: CommunicationChannel;
  enabled: boolean;
  consentVersion?: string;
  consentPurpose?: string;
  consentSource?: string;
}

@Injectable()
export class CommunicationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  getPreference(
    userId: string,
    channel: CommunicationChannel,
  ): Promise<CommunicationPreference | null> {
    return this.prisma.communicationPreference.findUnique({
      where: {
        userId_channel: { userId, channel },
      },
    });
  }

  async upsertPreference(
    input: UpsertCommunicationPreferenceInput,
  ): Promise<CommunicationPreference> {
    const currentPreference = await this.getPreference(
      input.userId,
      input.channel,
    );
    const now = new Date();
    const isOptingIn = input.enabled && currentPreference?.enabled !== true;
    const isOptingOut = !input.enabled && currentPreference?.enabled === true;
    const consentMetadata = {
      ...(input.consentVersion !== undefined
        ? { consentVersion: input.consentVersion }
        : {}),
      ...(input.consentPurpose !== undefined
        ? { consentPurpose: input.consentPurpose }
        : {}),
      ...(input.consentSource !== undefined
        ? { consentSource: input.consentSource }
        : {}),
    };

    return this.prisma.communicationPreference.upsert({
      where: {
        userId_channel: {
          userId: input.userId,
          channel: input.channel,
        },
      },
      create: {
        userId: input.userId,
        channel: input.channel,
        enabled: input.enabled,
        optedInAt: input.enabled ? now : null,
        optedOutAt: null,
        ...consentMetadata,
      },
      update: {
        enabled: input.enabled,
        ...(isOptingIn ? { optedInAt: now, optedOutAt: null } : {}),
        ...(isOptingOut ? { optedOutAt: now } : {}),
        ...consentMetadata,
      },
    });
  }
}
