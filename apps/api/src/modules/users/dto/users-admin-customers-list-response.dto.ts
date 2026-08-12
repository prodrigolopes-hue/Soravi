import {
  UserStatus,
} from "../../../generated/prisma/client";

export type UsersAdminCustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
};

export class UsersAdminCustomerItemResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  status!: UserStatus;
  emailVerified!: boolean;
  phoneVerified!: boolean;
  createdAt!: Date;

  constructor(record: UsersAdminCustomerRecord) {
    this.id = record.id;
    this.name = record.name;
    this.email = record.email;
    this.phone = record.phone;
    this.status = record.status;
    this.emailVerified = record.emailVerifiedAt !== null;
    this.phoneVerified = record.phoneVerifiedAt !== null;
    this.createdAt = record.createdAt;
  }
}

export class UsersAdminCustomersPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class UsersAdminCustomersListResponseDto {
  items!: UsersAdminCustomerItemResponseDto[];
  pagination!: UsersAdminCustomersPaginationResponseDto;

  constructor(
    items: UsersAdminCustomerRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new UsersAdminCustomerItemResponseDto(item),
    );

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}