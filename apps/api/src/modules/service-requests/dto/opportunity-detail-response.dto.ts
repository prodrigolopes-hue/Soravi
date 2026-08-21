import { ServiceRequestStatus } from "../../../generated/prisma/client";

export interface OpportunityPhotoDetailResponseDtoProperties {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  url: string;
}

export class OpportunityPhotoDetailResponseDto {
  readonly id: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly position: number;
  readonly url: string;

  constructor(properties: OpportunityPhotoDetailResponseDtoProperties) {
    this.id = properties.id;
    this.originalName = properties.originalName;
    this.mimeType = properties.mimeType;
    this.sizeBytes = properties.sizeBytes;
    this.position = properties.position;
    this.url = properties.url;
  }
}

export interface OpportunityDetailResponseProperties {
  id: string;
  createdAt: Date;
  viewedAt: Date | null;
  serviceRequest: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceRequestStatus;
    state: string;
    city: string;
    neighborhood: string;
    category: {
      id: string;
      name: string;
    };
    photos?: OpportunityPhotoDetailResponseDto[];
  };
}

export class OpportunityDetailResponseDto {
  opportunityId!: string;
  createdAt!: Date;
  viewedAt!: Date | null;
  serviceRequest!: {
    id: string;
    title: string;
    description: string | null;
    status: ServiceRequestStatus;
    category: {
      id: string;
      name: string;
    };
    location: {
      state: string;
      city: string;
      neighborhood: string;
    };
    photos: OpportunityPhotoDetailResponseDto[];
  };

  constructor(properties: OpportunityDetailResponseProperties) {
    this.opportunityId = properties.id;
    this.createdAt = properties.createdAt;
    this.viewedAt = properties.viewedAt;
    this.serviceRequest = {
      id: properties.serviceRequest.id,
      title: properties.serviceRequest.title,
      description: properties.serviceRequest.description,
      status: properties.serviceRequest.status,
      category: properties.serviceRequest.category,
      location: {
        state: properties.serviceRequest.state,
        city: properties.serviceRequest.city,
        neighborhood: properties.serviceRequest.neighborhood,
      },
      photos: properties.serviceRequest.photos ?? [],
    };
  }
}