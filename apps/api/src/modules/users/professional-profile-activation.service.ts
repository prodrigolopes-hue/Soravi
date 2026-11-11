import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service";
import { lockUserCategoryProtection } from "../../database/user-transaction-lock";
import { Prisma, Role, ServiceRequestStatus, UserStatus } from "../../generated/prisma/client";
import { UserResponseDto } from "./dto/user-response.dto";
import { ActivateCurrentProfessionalProfileDto } from "./dto/activate-current-professional-profile.dto";
import { InvalidProfessionalProfileCategoriesException } from "./errors/invalid-professional-profile-categories.exception";
import { ProfessionalCategoryOpenServiceRequestException } from "./errors/professional-category-open-service-request.exception";
import { ProfessionalProfileActivationUnavailableException } from "./errors/professional-profile-activation-unavailable.exception";
import { UsersService } from "./users.service";

@Injectable()
export class ProfessionalProfileActivationService {
  constructor(private readonly prisma: PrismaService, private readonly usersService: UsersService) {}

  async activateCurrentCustomer(userId: string, input: ActivateCurrentProfessionalProfileDto): Promise<UserResponseDto> {
    await this.prisma.$transaction(async (transaction) => {
      await lockUserCategoryProtection(transaction, userId);

      const user = await transaction.user.findFirst({
        where: { id: userId, status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] }, deletedAt: null, roles: { some: { role: Role.CUSTOMER } }, customerProfile: { is: {} } },
        select: { id: true, name: true, roles: { where: { role: Role.PROFESSIONAL }, select: { id: true } }, professionalProfile: { select: { id: true, deletedAt: true, professionalCategories: { select: { categoryId: true } } } } },
      });
      if (!user) throw new ProfessionalProfileActivationUnavailableException();

      if (user.professionalProfile?.deletedAt) throw new ProfessionalProfileActivationUnavailableException();

      if (user.professionalProfile) {
        if (user.roles.length === 0) {
          await this.ensureNoOpenOwnRequest(transaction, userId, user.professionalProfile.professionalCategories.map(({ categoryId }) => categoryId));
        }
        await transaction.userRole.upsert({ where: { userId_role: { userId, role: Role.PROFESSIONAL } }, update: {}, create: { userId, role: Role.PROFESSIONAL } });
        return;
      }

      if (input.categorySlugs.length < 1 || input.categorySlugs.length > 3 || new Set(input.categorySlugs).size !== input.categorySlugs.length) {
        throw new InvalidProfessionalProfileCategoriesException();
      }
      const categories = await transaction.category.findMany({ where: { slug: { in: input.categorySlugs }, isActive: true }, select: { id: true } });
      if (categories.length !== input.categorySlugs.length) throw new InvalidProfessionalProfileCategoriesException();
      await this.ensureNoOpenOwnRequest(transaction, userId, categories.map(({ id }) => id));

      await transaction.professionalProfile.create({ data: {
        userId, displayName: user.name, professionalTitle: input.professionalTitle, serviceArea: input.serviceArea, bio: input.bio,
        professionalCategories: { create: categories.map(({ id }) => ({ categoryId: id })) },
      } });
      await transaction.userRole.upsert({ where: { userId_role: { userId, role: Role.PROFESSIONAL } }, update: {}, create: { userId, role: Role.PROFESSIONAL } });
    });
    return this.usersService.findSafeById(userId);
  }

  private async ensureNoOpenOwnRequest(transaction: Prisma.TransactionClient, userId: string, categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return;
    const request = await transaction.serviceRequest.findFirst({ where: { customerProfile: { userId }, categoryId: { in: categoryIds }, deletedAt: null, status: { in: [ServiceRequestStatus.OPEN, ServiceRequestStatus.RECEIVING_PROPOSALS, ServiceRequestStatus.IN_NEGOTIATION] } }, select: { id: true } });
    if (request) throw new ProfessionalCategoryOpenServiceRequestException();
  }
}
