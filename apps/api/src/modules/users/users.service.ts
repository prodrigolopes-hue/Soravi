import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { UserResponseDto } from "./dto/user-response.dto";
import { UserNotFoundException } from "./errors/user-not-found.exception";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  roles: {
    select: {
      role: true,
    },
  },
  customerProfile: {
    select: {
      id: true,
    },
  },
  professionalProfile: {
    select: {
      id: true,
      displayName: true,
      verificationStatus: true,
      isAvailable: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findSafeById(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: safeUserSelect,
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return new UserResponseDto({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.roles.map(({ role }) => role),
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      customerProfile: user.customerProfile,
      professionalProfile: user.professionalProfile,
      createdAt: user.createdAt,
    });
  }
}