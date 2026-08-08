import type { LaunchInterestSource, LaunchInterestType } from "../../../generated/prisma/client";

export type LaunchInterestAdminRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  audienceType: LaunchInterestType;
  city: string;
  state: string | null;
  serviceInterest: string | null;
  professionalCategoryInterest: string | null;
  source: LaunchInterestSource;
  privacyNoticeAcceptedAt: Date;
  marketingConsentAt: Date | null;
  emailConfirmedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class LaunchInterestAdminItemResponseDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string | null;
  audienceType!: LaunchInterestType;
  city!: string;
  state!: string | null;
  serviceInterest!: string | null;
  professionalCategoryInterest!: string | null;
  source!: LaunchInterestSource;
  privacyNoticeAcceptedAt!: Date;
  marketingConsentAt!: Date | null;
  emailConfirmedAt!: Date | null;
  unsubscribedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(record: LaunchInterestAdminRecord) {
    this.id = record.id;
    this.name = record.name;
    this.email = record.email;
    this.phone = record.phone;
    this.audienceType = record.audienceType;
    this.city = record.city;
    this.state = record.state;
    this.serviceInterest = record.serviceInterest;
    this.professionalCategoryInterest = record.professionalCategoryInterest;
    this.source = record.source;
    this.privacyNoticeAcceptedAt = record.privacyNoticeAcceptedAt;
    this.marketingConsentAt = record.marketingConsentAt;
    this.emailConfirmedAt = record.emailConfirmedAt;
    this.unsubscribedAt = record.unsubscribedAt;
    this.createdAt = record.createdAt;
    this.updatedAt = record.updatedAt;
  }
}

export class LaunchInterestAdminPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class LaunchInterestAdminListResponseDto {
  items!: LaunchInterestAdminItemResponseDto[];
  pagination!: LaunchInterestAdminPaginationResponseDto;

  constructor(
    items: LaunchInterestAdminRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new LaunchInterestAdminItemResponseDto(item),
    );

    const totalPages = Math.ceil(total / pageSize);

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages,
    };
  }
}
