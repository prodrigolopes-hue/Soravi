import { ContractStatus, ServiceRequestStatus } from "../../../generated/prisma/client";

export interface ServiceRequestLocationResponseDto {
  country: string;
  state: string;
  city: string;
  neighborhood: string;
  postalCode: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string | null;
}

export interface ServiceRequestPhotoDetailResponseDtoProperties {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  url: string;
}

export class ServiceRequestPhotoDetailResponseDto {
  readonly id: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly position: number;
  readonly url: string;

  constructor(properties: ServiceRequestPhotoDetailResponseDtoProperties) {
    this.id = properties.id;
    this.originalName = properties.originalName;
    this.mimeType = properties.mimeType;
    this.sizeBytes = properties.sizeBytes;
    this.position = properties.position;
    this.url = properties.url;
  }
}

export interface ServiceRequestResponseDtoProperties {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  status: ServiceRequestStatus;
  visibleProposalLimit?: number;
  location: ServiceRequestLocationResponseDto;
  editableUntil: Date;
  createdAt: Date;
  conversationId?: string | null;
  contract?: { id: string; status: ContractStatus; completedAt: Date | null; review?: { id: string; rating: number; comment: string | null; publishedAt: Date | null } | null; customerReview?: { id: string; rating: number; comment: string | null; publishedAt: Date | null } | null } | null;
  photos?: ServiceRequestPhotoDetailResponseDto[];
}

export class ServiceRequestResponseDto {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: ServiceRequestStatus;
  readonly visibleProposalLimit: number;
  readonly location: ServiceRequestLocationResponseDto;
  readonly editableUntil: Date;
  readonly createdAt: Date;
  readonly conversationId: string | null;
  readonly contract: { id: string; status: ContractStatus; completedAt: Date | null; review?: { id: string; rating: number; comment: string | null; publishedAt: Date | null } | null; customerReview?: { id: string; rating: number; comment: string | null; publishedAt: Date | null } | null } | null;
  readonly photos: ServiceRequestPhotoDetailResponseDto[];

  constructor(properties: ServiceRequestResponseDtoProperties) {
    this.id = properties.id;
    this.categoryId = properties.categoryId;
    this.title = properties.title;
    this.description = properties.description;
    this.status = properties.status;
    this.visibleProposalLimit = properties.visibleProposalLimit ?? 3;
    this.location = properties.location;
    this.editableUntil = properties.editableUntil;
    this.createdAt = properties.createdAt;
    this.conversationId = properties.conversationId ?? null;
    this.contract = properties.contract ?? null;
    this.photos = properties.photos ?? [];
  }
}
