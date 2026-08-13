import { CategoryRequestStatus } from "../../../generated/prisma/client";

export type CategoryRequestsAdminItemRecord = {
  id: string;
  suggestedName: string;
  status: CategoryRequestStatus;
  reviewNotes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  professionalProfile: {
    id: string;
    displayName: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  resolvedCategory: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export class CategoryRequestsAdminProfessionalUserResponseDto {
  id!: string;
  name!: string;
  email!: string;

  constructor(
    properties: CategoryRequestsAdminItemRecord["professionalProfile"]["user"],
  ) {
    this.id = properties.id;
    this.name = properties.name;
    this.email = properties.email;
  }
}

export class CategoryRequestsAdminProfessionalProfileResponseDto {
  id!: string;
  displayName!: string;
  user!: CategoryRequestsAdminProfessionalUserResponseDto;

  constructor(
    properties: CategoryRequestsAdminItemRecord["professionalProfile"],
  ) {
    this.id = properties.id;
    this.displayName = properties.displayName;
    this.user = new CategoryRequestsAdminProfessionalUserResponseDto(
      properties.user,
    );
  }
}

export class CategoryRequestsAdminResolvedCategoryResponseDto {
  id!: string;
  name!: string;
  slug!: string;

  constructor(
    properties: NonNullable<
      CategoryRequestsAdminItemRecord["resolvedCategory"]
    >,
  ) {
    this.id = properties.id;
    this.name = properties.name;
    this.slug = properties.slug;
  }
}

export class CategoryRequestsAdminItemResponseDto {
  id!: string;
  suggestedName!: string;
  status!: CategoryRequestStatus;
  reviewNotes!: string | null;
  createdAt!: Date;
  reviewedAt!: Date | null;
  professionalProfile!: CategoryRequestsAdminProfessionalProfileResponseDto;
  resolvedCategory!: CategoryRequestsAdminResolvedCategoryResponseDto | null;

  constructor(properties: CategoryRequestsAdminItemRecord) {
    this.id = properties.id;
    this.suggestedName = properties.suggestedName;
    this.status = properties.status;
    this.reviewNotes = properties.reviewNotes;
    this.createdAt = properties.createdAt;
    this.reviewedAt = properties.reviewedAt;
    this.professionalProfile = new CategoryRequestsAdminProfessionalProfileResponseDto(
      properties.professionalProfile,
    );
    this.resolvedCategory = properties.resolvedCategory
      ? new CategoryRequestsAdminResolvedCategoryResponseDto(
        properties.resolvedCategory,
      )
      : null;
  }
}

export class CategoryRequestsAdminPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class CategoryRequestsAdminListResponseDto {
  items!: CategoryRequestsAdminItemResponseDto[];
  pagination!: CategoryRequestsAdminPaginationResponseDto;

  constructor(
    items: CategoryRequestsAdminItemRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new CategoryRequestsAdminItemResponseDto(item),
    );

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}