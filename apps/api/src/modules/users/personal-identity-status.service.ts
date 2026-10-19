import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { UserNotFoundException } from "./errors/user-not-found.exception";

export interface PersonalIdentityStatusResult {
  recorded: boolean;
}

@Injectable()
export class PersonalIdentityStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(userId: string): Promise<PersonalIdentityStatusResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        personalIdentity: {
          select: { id: true },
        },
      },
    });

    if (!user) throw new UserNotFoundException();

    return { recorded: user.personalIdentity !== null };
  }
}
