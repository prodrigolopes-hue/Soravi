import { Injectable } from "@nestjs/common";

import {
  Prisma,
  Role,
} from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { UsersAdminCustomersListResponseDto } from "./dto/users-admin-customers-list-response.dto";
import { UsersAdminCustomersQueryDto } from "./dto/users-admin-customers-query.dto";
import { UsersAdminProfessionalRecord, UsersAdminProfessionalsListResponseDto } from "./dto/users-admin-professionals-list-response.dto";
import { UsersAdminProfessionalsQueryDto } from "./dto/users-admin-professionals-query.dto";
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

const adminCustomersSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const adminProfessionalsSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
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

  async findAllAdminCustomers(
    query: UsersAdminCustomersQueryDto,
  ): Promise<UsersAdminCustomersListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      customerProfile: {
        isNot: null,
      },
      roles: {
        some: {
          role: Role.CUSTOMER,
        },
      },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminCustomersSelect,
      }),
    ]);

    return new UsersAdminCustomersListResponseDto(
      items,
      page,
      pageSize,
      total,
    );
  }

  async findAllAdminProfessionals(
    query: UsersAdminProfessionalsQueryDto,
  ): Promise<UsersAdminProfessionalsListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      roles: {
        some: {
          role: Role.PROFESSIONAL,
        },
      },
      professionalProfile: {
        is: {
          deletedAt: null,
        },
      },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: adminProfessionalsSelect,
      }),
    ]);

    const normalizedItems: UsersAdminProfessionalRecord[] = items.reduce<UsersAdminProfessionalRecord[]>((accumulator, item) => {
      if (!item.professionalProfile) {
        return accumulator;
      }

      accumulator.push({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone,
        status: item.status,
        emailVerifiedAt: item.emailVerifiedAt,
        phoneVerifiedAt: item.phoneVerifiedAt,
        createdAt: item.createdAt,
        professionalProfile: {
          id: item.professionalProfile.id,
          displayName: item.professionalProfile.displayName,
          verificationStatus: item.professionalProfile.verificationStatus,
          isAvailable: item.professionalProfile.isAvailable,
        },
      });

      return accumulator;
    }, []);

    return new UsersAdminProfessionalsListResponseDto(
      normalizedItems,
      page,
      pageSize,
      total,
    );
  }

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