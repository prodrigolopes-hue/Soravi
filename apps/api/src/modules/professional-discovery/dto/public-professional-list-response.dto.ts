export interface PublicProfessionalCategoryProperties {
  id: string;
  name: string;
  slug: string;
}

export interface PublicProfessionalReputationProperties {
  averageRating: number;
  reviewCount: number;
}

export interface PublicProfessionalListItemProperties {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  categories: PublicProfessionalCategoryProperties[];
  reputation: PublicProfessionalReputationProperties;
}

export class PublicProfessionalCategoryResponseDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;

  constructor(properties: PublicProfessionalCategoryProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.slug = properties.slug;
  }
}

export class PublicProfessionalReputationResponseDto {
  readonly averageRating: number;
  readonly reviewCount: number;

  constructor(properties: PublicProfessionalReputationProperties) {
    this.averageRating = properties.averageRating;
    this.reviewCount = properties.reviewCount;
  }
}

export class PublicProfessionalListItemResponseDto {
  readonly id: string;
  readonly displayName: string;
  readonly professionalTitle: string | null;
  readonly serviceArea: string | null;
  readonly categories: PublicProfessionalCategoryResponseDto[];
  readonly reputation: PublicProfessionalReputationResponseDto;

  constructor(properties: PublicProfessionalListItemProperties) {
    this.id = properties.id;
    this.displayName = properties.displayName;
    this.professionalTitle = properties.professionalTitle;
    this.serviceArea = properties.serviceArea;
    this.categories = properties.categories.map(
      (category) => new PublicProfessionalCategoryResponseDto(category),
    );
    this.reputation = new PublicProfessionalReputationResponseDto(
      properties.reputation,
    );
  }
}

export class PublicProfessionalsPaginationResponseDto {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = Math.ceil(total / limit);
  }
}

export class PublicProfessionalListResponseDto {
  readonly items: PublicProfessionalListItemResponseDto[];
  readonly pagination: PublicProfessionalsPaginationResponseDto;

  constructor(
    items: PublicProfessionalListItemProperties[],
    page: number,
    limit: number,
    total: number,
  ) {
    this.items = items.map(
      (item) => new PublicProfessionalListItemResponseDto(item),
    );
    this.pagination = new PublicProfessionalsPaginationResponseDto(
      page,
      limit,
      total,
    );
  }
}
