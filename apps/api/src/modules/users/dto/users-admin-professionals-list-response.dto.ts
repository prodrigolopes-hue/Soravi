import {
  ProfessionalVerificationStatus,
  UserStatus,
} from "../../../generated/prisma/client";

export type UsersAdminProfessionalRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  professionalProfile: {
    id: string;
    displayName: string;
    verificationStatus: ProfessionalVerificationStatus;
    isAvailable: boolean;
  };
};

export class UsersAdminProfessionalProfileItemResponseDto {
  id!: string;
  displayName!: string;
  verificationStatus!: ProfessionalVerificationStatus;
  isAvailable!: boolean;

  constructor(record: UsersAdminProfessionalRecord["professionalProfile"]) {
    this.id = record.id;
    this.displayName = record.displayName;
    this.verificationStatus = record.verificationStatus;
    this.isAvailable = record.isAvailable;
  }
}

export class UsersAdminProfessionalItemResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  status!: UserStatus;
  emailVerified!: boolean;
  phoneVerified!: boolean;
  createdAt!: Date;
  professionalProfile!: UsersAdminProfessionalProfileItemResponseDto;

  constructor(record: UsersAdminProfessionalRecord) {
    this.id = record.id;
    this.name = record.name;
    this.email = record.email;
    this.phone = record.phone;
    this.status = record.status;
    this.emailVerified = record.emailVerifiedAt !== null;
    this.phoneVerified = record.phoneVerifiedAt !== null;
    this.createdAt = record.createdAt;
    this.professionalProfile =
      new UsersAdminProfessionalProfileItemResponseDto(
        record.professionalProfile,
      );
  }
}

export class UsersAdminProfessionalsPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class UsersAdminProfessionalsListResponseDto {
  items!: UsersAdminProfessionalItemResponseDto[];
  pagination!: UsersAdminProfessionalsPaginationResponseDto;

  constructor(
    items: UsersAdminProfessionalRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new UsersAdminProfessionalItemResponseDto(item),
    );

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
