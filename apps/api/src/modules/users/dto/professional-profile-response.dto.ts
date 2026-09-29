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

export class ProfessionalProfileResponseDto {
  readonly id: string;
  readonly displayName: string;
  readonly professionalTitle: string | null;
  readonly serviceArea: string | null;
  readonly bio: string | null;
  readonly isAvailable: boolean;
  readonly verificationStatus: ProfessionalVerificationStatus;
  readonly categories: ProfessionalProfileCategoryResponseDto[];

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
  }
}
