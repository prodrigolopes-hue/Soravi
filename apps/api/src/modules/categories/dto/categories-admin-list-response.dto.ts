import { CategoryResponseDtoProperties } from "./category-response.dto";

export type CategoriesAdminCategoryRecord = Pick<
  CategoryResponseDtoProperties,
  "id" | "name" | "slug" | "displayOrder"
> & {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CategoriesAdminCategoryItemResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  isActive!: boolean;
  displayOrder!: number;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(record: CategoriesAdminCategoryRecord) {
    this.id = record.id;
    this.name = record.name;
    this.slug = record.slug;
    this.isActive = record.isActive;
    this.displayOrder = record.displayOrder;
    this.createdAt = record.createdAt;
    this.updatedAt = record.updatedAt;
  }
}

export class CategoriesAdminPaginationResponseDto {
  page!: number;
  pageSize!: number;
  total!: number;
  totalPages!: number;
}

export class CategoriesAdminListResponseDto {
  items!: CategoriesAdminCategoryItemResponseDto[];
  pagination!: CategoriesAdminPaginationResponseDto;

  constructor(
    items: CategoriesAdminCategoryRecord[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new CategoriesAdminCategoryItemResponseDto(item),
    );

    this.pagination = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}