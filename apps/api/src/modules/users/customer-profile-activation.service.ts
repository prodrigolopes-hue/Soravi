import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { Role, UserStatus } from "../../generated/prisma/client";
import { UserResponseDto } from "./dto/user-response.dto";
import { CustomerProfileActivationUnavailableException } from "./errors/customer-profile-activation-unavailable.exception";
import { UsersService } from "./users.service";

@Injectable()
export class CustomerProfileActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async activateCurrentProfessional(userId: string): Promise<UserResponseDto> {
    await this.prisma.$transaction(async (transaction) => {
      await lockUserCategoryProtection(transaction, userId);

      const eligibleProfessional = await transaction.user.findFirst({
        where: {
          id: userId,
          status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] },
          deletedAt: null,
          roles: { some: { role: Role.PROFESSIONAL } },
          professionalProfile: { is: { deletedAt: null } },
        },
        select: { id: true },
      });

      if (!eligibleProfessional) {
        throw new CustomerProfileActivationUnavailableException();
      }

      await transaction.customerProfile.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      await transaction.userRole.upsert({
        where: { userId_role: { userId, role: Role.CUSTOMER } },
        update: {},
        create: { userId, role: Role.CUSTOMER },
      });
    });

    return this.usersService.findSafeById(userId);
  }
}
