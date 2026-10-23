import {
  PublicProfessionalCategoryResponseDto,
  PublicProfessionalReputationResponseDto,
  PublicProfessionalPhotoResponseDto,
  type PublicProfessionalCategoryProperties,
  type PublicProfessionalReputationProperties,
  type PublicProfessionalPhotoProperties,
  PublicProfessionalsPaginationResponseDto,
} from "./public-professional-list-response.dto";

export interface PublicProfessionalReviewProperties {
  rating: number;
  comment: string | null;
  publishedAt: Date;
}

export interface PublicProfessionalProfileProperties {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  bio: string | null;
  categories: PublicProfessionalCategoryProperties[];
  reputation: PublicProfessionalReputationProperties;
  reviews: PublicProfessionalReviewProperties[];
  reviewsPage: number;
  reviewsLimit: number;
  reviewsTotal: number;
  photo: PublicProfessionalPhotoProperties | null;
}

export class PublicProfessionalReviewResponseDto {
  readonly rating: number;
  readonly comment: string | null;
  readonly publishedAt: Date;

  constructor(properties: PublicProfessionalReviewProperties) {
    this.rating = properties.rating;
    this.comment = properties.comment;
    this.publishedAt = properties.publishedAt;
  }
}

export class PublicProfessionalProfileResponseDto {
  readonly id: string;
  readonly displayName: string;
  readonly professionalTitle: string | null;
  readonly serviceArea: string | null;
  readonly bio: string | null;
  readonly categories: PublicProfessionalCategoryResponseDto[];
  readonly reputation: PublicProfessionalReputationResponseDto;
  readonly reviews: {
    items: PublicProfessionalReviewResponseDto[];
    pagination: PublicProfessionalsPaginationResponseDto;
  };
  readonly photo: PublicProfessionalPhotoResponseDto | null;

  constructor(properties: PublicProfessionalProfileProperties) {
    this.id = properties.id;
    this.displayName = properties.displayName;
    this.professionalTitle = properties.professionalTitle;
    this.serviceArea = properties.serviceArea;
    this.bio = properties.bio;
    this.categories = properties.categories.map(
      (category) => new PublicProfessionalCategoryResponseDto(category),
    );
    this.reputation = new PublicProfessionalReputationResponseDto(
      properties.reputation,
    );
    this.reviews = {
      items: properties.reviews.map(
        (review) => new PublicProfessionalReviewResponseDto(review),
      ),
      pagination: new PublicProfessionalsPaginationResponseDto(
        properties.reviewsPage,
        properties.reviewsLimit,
        properties.reviewsTotal,
      ),
    };
    this.photo = properties.photo
      ? new PublicProfessionalPhotoResponseDto(properties.photo)
      : null;
  }
}
