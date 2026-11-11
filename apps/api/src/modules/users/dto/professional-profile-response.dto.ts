import { ProfessionalVerificationStatus } from "../../../generated/prisma/client";

interface ProfessionalProfileCategoryResponseProperties {
  id: string;
  name: string;
  slug: string;
}

interface ProfessionalProfileResponseProperties {
  id: string;
  displayName: string;
  professionalTitle: string | null;
  serviceArea: string | null;
  bio: string | null;
  isAvailable: boolean;
  verificationStatus: ProfessionalVerificationStatus;
  categories: ProfessionalProfileCategoryResponseProperties[];
  photo: ProfessionalProfilePhotoResponseProperties | null;
  portfolio: ProfessionalPortfolioItemResponseProperties[];
}

export interface ProfessionalProfilePhotoResponseProperties {
  url: string;
  expiresAt: string;
}

export class ProfessionalProfileCategoryResponseDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;

  constructor(properties: ProfessionalProfileCategoryResponseProperties) {
    this.id = properties.id;
    this.name = properties.name;
    this.slug = properties.slug;
  }
}

export class ProfessionalProfilePhotoResponseDto {
  readonly url: string;
  readonly expiresAt: string;

  constructor(properties: ProfessionalProfilePhotoResponseProperties) {
    this.url = properties.url;
    this.expiresAt = properties.expiresAt;
  }
}
export interface ProfessionalPortfolioItemResponseProperties { id: string; url: string | null; expiresAt: string | null; caption: string | null; status: string; rejectionReasonCode: string | null; rejectionReason: string | null; }
export class ProfessionalPortfolioItemResponseDto {
  readonly id: string; readonly url: string | null; readonly expiresAt: string | null; readonly caption: string | null; readonly status: string; readonly rejectionReasonCode: string | null; readonly rejectionReason: string | null;
  constructor(properties: ProfessionalPortfolioItemResponseProperties) { this.id = properties.id; this.url = properties.url; this.expiresAt = properties.expiresAt; this.caption = properties.caption; this.status = properties.status; this.rejectionReasonCode = properties.rejectionReasonCode; this.rejectionReason = properties.rejectionReason; }
}

export class ProfessionalProfileResponseDto {
  readonly id: string;
  readonly displayName: string;
  readonly professionalTitle: string | null;
  readonly serviceArea: string | null;
  readonly bio: string | null;
  readonly isAvailable: boolean;
  readonly verificationStatus: ProfessionalVerificationStatus;
  readonly categories: ProfessionalProfileCategoryResponseDto[];
  readonly photo: ProfessionalProfilePhotoResponseDto | null;
  readonly portfolio: ProfessionalPortfolioItemResponseDto[];

  constructor(properties: ProfessionalProfileResponseProperties) {
    this.id = properties.id;
    this.displayName = properties.displayName;
    this.professionalTitle = properties.professionalTitle;
    this.serviceArea = properties.serviceArea;
    this.bio = properties.bio;
    this.isAvailable = properties.isAvailable;
    this.verificationStatus = properties.verificationStatus;
    this.categories = properties.categories.map(
      (category) => new ProfessionalProfileCategoryResponseDto(category),
    );
    this.photo = properties.photo
      ? new ProfessionalProfilePhotoResponseDto(properties.photo)
      : null;
    this.portfolio = properties.portfolio.map((item) => new ProfessionalPortfolioItemResponseDto(item));
  }
}
